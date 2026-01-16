"""Views for Deal Progression module."""
from __future__ import annotations

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Q, Prefetch, Max
from django.utils import timezone

from accounts.permissions import IsAdmin, IsLender
from .models import (
    Deal, DealParty, DealStage, DealTask, DealCP, DealRequisition,
    Drawdown, DealMessageThread, DealMessage, DealDocumentLink,
    DealDecision, AuditEvent, LawFirm, LawFirmPanelMembership,
    ProviderEnquiry, ProviderQuote, DealProviderSelection, ProviderStageInstance,
    ProviderDeliverable, ProviderAppointment
)
from documents.models import Document
from .serializers import (
    DealSerializer, DealPartySerializer, DealStageSerializer,
    DealTaskSerializer, DealCPSerializer, DealRequisitionSerializer,
    DrawdownSerializer, DealMessageThreadSerializer, DealMessageSerializer,
    DealDocumentLinkSerializer, DealDecisionSerializer, AuditEventSerializer,
    LawFirmSerializer, LawFirmPanelMembershipSerializer,
    ProviderEnquirySerializer, ProviderQuoteSerializer, DealProviderSelectionSerializer,
    ProviderStageInstanceSerializer, ProviderDeliverableSerializer, ProviderAppointmentSerializer
)
from rest_framework.parsers import MultiPartParser, FormParser
from .services import DealService, WorkflowEngine


class DealViewSet(viewsets.ModelViewSet):
    """ViewSet for Deal CRUD operations."""
    
    serializer_class = DealSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'deal_id'  # Use deal_id instead of pk for URL lookups
    
    def get_queryset(self):
        """Filter deals based on user role and permissions."""
        user = self.request.user
        
        # Admin sees all deals
        if IsAdmin().has_permission(self.request, self):
            return Deal.objects.select_related(
                'lender', 'borrower_company', 'current_stage', 'application'
            ).prefetch_related('parties', 'stages', 'tasks').all()
        
        # Lender sees their deals
        if hasattr(user, 'lenderprofile'):
            return Deal.objects.filter(lender=user.lenderprofile).select_related(
                'lender', 'borrower_company', 'current_stage', 'application'
            ).prefetch_related('parties', 'stages', 'tasks').all()
        
        # Borrower sees their deals
        if hasattr(user, 'borrowerprofile'):
            return Deal.objects.filter(borrower_company=user.borrowerprofile).select_related(
                'lender', 'borrower_company', 'current_stage', 'application'
            ).prefetch_related('parties', 'stages', 'tasks').all()
        
        # Consultant sees deals they're involved with (via DealParty, ProviderEnquiry, ProviderQuote, or DealProviderSelection)
        if hasattr(user, 'consultantprofile'):
            consultant_profile = user.consultantprofile
            
            # Get deals via DealParty
            deals_via_party = Deal.objects.filter(
                parties__consultant_profile=consultant_profile,
                parties__appointment_status='active'
            )
            
            # Get deals via ProviderEnquiry (quote requests sent to them)
            deals_via_enquiry = Deal.objects.filter(
                provider_enquiries__provider_firm=consultant_profile
            )
            
            # Get deals via ProviderQuote (quotes they submitted)
            # ProviderQuote.enquiry -> ProviderEnquiry.deal, and ProviderEnquiry.provider_firm = consultant
            deals_via_quote = Deal.objects.filter(
                provider_enquiries__provider_firm=consultant_profile,
                provider_enquiries__quotes__isnull=False
            )
            
            # Get deals via DealProviderSelection (they were selected)
            deals_via_selection = Deal.objects.filter(
                provider_selections__provider_firm=consultant_profile
            )
            
            # Combine all deals
            all_deals = (
                deals_via_party |
                deals_via_enquiry |
                deals_via_quote |
                deals_via_selection
            ).distinct()
            
            return all_deals.select_related(
                'lender', 'borrower_company', 'current_stage', 'application'
            ).prefetch_related('parties', 'stages', 'tasks')
        
        return Deal.objects.none()
    
    @action(detail=True, methods=['get'])
    def readiness_score(self, request, pk=None):
        """Get completion readiness score for a deal."""
        deal = self.get_object()
        deal.calculate_readiness_score()
        deal.save()
        return Response({
            'score': deal.completion_readiness_score,
            'breakdown': deal.completion_readiness_breakdown,
        })
    
    @action(detail=True, methods=['post'])
    def advance_stage(self, request, pk=None):
        """Advance deal to next stage."""
        deal = self.get_object()
        workflow = WorkflowEngine(deal)
        next_stage = workflow.advance_to_next_stage()
        
        if next_stage:
            return Response({
                'success': True,
                'current_stage': DealStageSerializer(next_stage).data,
                'message': f'Deal advanced to {next_stage.name}',
            })
        return Response({
            'success': False,
            'message': 'Cannot advance: exit criteria not met or already at final stage',
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'], url_path='timeline')
    def timeline(self, request, deal_id=None):
        """Get deal timeline with all events."""
        deal = self.get_object()
        stages = DealStage.objects.filter(deal=deal).order_by('stage_number')
        tasks = DealTask.objects.filter(deal=deal).order_by('created_at')
        decisions = DealDecision.objects.filter(deal=deal).order_by('made_at')
        audit_events = AuditEvent.objects.filter(deal=deal).order_by('timestamp')
        
        return Response({
            'stages': DealStageSerializer(stages, many=True).data,
            'tasks': DealTaskSerializer(tasks, many=True).data,
            'decisions': DealDecisionSerializer(decisions, many=True).data,
            'audit_events': AuditEventSerializer(audit_events, many=True).data,
        })
    
    @action(detail=False, methods=['get'], url_path='my-deals')
    def my_deals(self, request):
        """Get deals for the current consultant with involvement details."""
        user = request.user
        
        if not hasattr(user, 'consultantprofile'):
            return Response(
                {'error': 'Only consultants can access this endpoint'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        consultant_profile = user.consultantprofile
        
        # Get all deals the consultant is involved with
        deals = self.get_queryset()
        
        # Enrich with involvement details
        enriched_deals = []
        for deal in deals:
            # Check involvement type
            involvement = {
                'via_party': DealParty.objects.filter(
                    deal=deal,
                    consultant_profile=consultant_profile,
                    appointment_status='active'
                ).exists(),
                'via_enquiry': ProviderEnquiry.objects.filter(
                    deal=deal,
                    provider_firm=consultant_profile
                ).exists(),
                'via_quote': ProviderQuote.objects.filter(
                    enquiry__deal=deal,
                    enquiry__provider_firm=consultant_profile
                ).exists(),
                'via_selection': DealProviderSelection.objects.filter(
                    deal=deal,
                    provider_firm=consultant_profile
                ).exists(),
            }
            
            # Get role type if selected
            role_type = None
            selection = DealProviderSelection.objects.filter(
                deal=deal,
                provider_firm=consultant_profile
            ).first()
            if selection:
                role_type = selection.role_type
            
            # Get party info if exists
            party = DealParty.objects.filter(
                deal=deal,
                consultant_profile=consultant_profile
            ).first()
            if party:
                role_type = role_type or party.party_type
                involvement['party_type'] = party.party_type
                involvement['acting_for_party'] = party.acting_for_party
                involvement['appointment_status'] = party.appointment_status
            
            # Get active enquiry if exists
            enquiry = ProviderEnquiry.objects.filter(
                deal=deal,
                provider_firm=consultant_profile
            ).first()
            if enquiry:
                involvement['enquiry_status'] = enquiry.status
                involvement['enquiry_role_type'] = enquiry.role_type
            
            deal_data = DealSerializer(deal).data
            deal_data['consultant_involvement'] = involvement
            deal_data['consultant_role_type'] = role_type
            enriched_deals.append(deal_data)
        
        return Response(enriched_deals)


class DealPartyViewSet(viewsets.ModelViewSet):
    """ViewSet for DealParty management."""
    
    serializer_class = DealPartySerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter parties based on user's access to deals."""
        user = self.request.user
        deal_id = self.request.query_params.get('deal_id')
        
        if deal_id:
            # Check if user has access to this deal
            deal = Deal.objects.filter(id=deal_id).first()
            if deal and self._user_has_deal_access(user, deal):
                return DealParty.objects.filter(deal=deal).select_related('user', 'deal')
        
        # Admin sees all
        if IsAdmin().has_permission(self.request, self):
            return DealParty.objects.select_related('user', 'deal').all()
        
        # Users see parties for deals they have access to
        deals = Deal.objects.filter(
            Q(lender__user=user) | 
            Q(borrower_company__user=user) |
            Q(parties__user=user, parties__is_active=True)
        ).distinct()
        
        return DealParty.objects.filter(deal__in=deals).select_related('user', 'deal')
    
    def _user_has_deal_access(self, user, deal):
        """Check if user has access to a deal."""
        if IsAdmin().has_permission(self.request, self):
            return True
        if hasattr(user, 'lenderprofile') and deal.lender == user.lenderprofile:
            return True
        if hasattr(user, 'borrowerprofile') and deal.borrower_company == user.borrowerprofile:
            return True
        if DealParty.objects.filter(deal=deal, user=user, is_active=True).exists():
            return True
        return False
    
    @action(detail=False, methods=['post'])
    def invite_consultant(self, request):
        """Invite a consultant (valuer, monitoring surveyor, solicitor) to a deal."""
        deal_id = request.data.get('deal_id')
        consultant_user_id = request.data.get('consultant_user_id')
        party_type = request.data.get('party_type')  # valuer, monitoring_surveyor, solicitor
        acting_for = request.data.get('acting_for_party')  # lender or borrower
        
        if not all([deal_id, consultant_user_id, party_type]):
            return Response(
                {'error': 'deal_id, consultant_user_id, and party_type are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate party type
        valid_types = ['valuer', 'monitoring_surveyor', 'solicitor']
        if party_type not in valid_types:
            return Response(
                {'error': f'party_type must be one of: {", ".join(valid_types)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get deal and verify user has permission
        try:
            deal = Deal.objects.get(id=deal_id)
        except Deal.DoesNotExist:
            return Response({'error': 'Deal not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Only lender can invite consultants
        user = request.user
        if not hasattr(user, 'lenderprofile') or deal.lender != user.lenderprofile:
            if not IsAdmin().has_permission(self.request, self):
                return Response(
                    {'error': 'Only lender can invite consultants'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # For lender solicitor: enforce single active solicitor
        if party_type == 'solicitor' and acting_for == 'lender':
            existing_active = DealParty.objects.filter(
                deal=deal,
                party_type='solicitor',
                acting_for_party='lender',
                is_active_lender_solicitor=True,
                appointment_status='active'
            ).first()
            
            if existing_active:
                return Response(
                    {'error': 'Only one active lender solicitor allowed per deal. Please remove or replace the existing solicitor first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Get consultant user (consultant_user_id can be user ID or consultant profile ID)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        consultant_user = None
        
        # Try as user ID first
        try:
            consultant_user = User.objects.get(id=consultant_user_id)
        except User.DoesNotExist:
            # Try as consultant profile ID
            try:
                from consultants.models import ConsultantProfile
                consultant_profile = ConsultantProfile.objects.get(id=consultant_user_id)
                consultant_user = consultant_profile.user
            except ConsultantProfile.DoesNotExist:
                return Response({'error': 'Consultant user not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if consultant profile exists
        if not hasattr(consultant_user, 'consultantprofile'):
            return Response(
                {'error': 'User is not a consultant'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create or get DealParty
        deal_party, created = DealParty.objects.get_or_create(
            deal=deal,
            user=consultant_user,
            party_type=party_type,
            defaults={
                'consultant_profile': consultant_user.consultantprofile,
                'acting_for_party': acting_for,
                'appointment_status': 'invited',
                'invited_by': user,
            }
        )
        
        if not created:
            return Response(
                {'error': 'Consultant already invited to this deal'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Log audit event
        AuditEvent.objects.create(
            deal=deal,
            actor_user=user,
            event_type='consultant_invited',
            object_type='deal_party',
            object_id=deal_party.id,
            metadata={
                'party_type': party_type,
                'acting_for': acting_for,
                'consultant_name': consultant_user.get_full_name() or consultant_user.username
            }
        )
        
        return Response(DealPartySerializer(deal_party).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm party invitation and set role details. Consultant MUST confirm actingForParty."""
        deal_party = self.get_object()
        
        # Only the invited user can confirm
        if deal_party.user != request.user:
            return Response(
                {'error': 'Only the invited user can confirm'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        acting_for = request.data.get('acting_for_party')
        firm_name = request.data.get('firm_name')
        sra_number = request.data.get('sra_number')
        rics_number = request.data.get('rics_number')
        
        # For consultants, acting_for_party is REQUIRED
        if deal_party.party_type in ['valuer', 'monitoring_surveyor', 'solicitor']:
            if not acting_for:
                return Response(
                    {'error': 'acting_for_party is required for consultants'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # For lender solicitor: enforce single active solicitor
        if deal_party.party_type == 'solicitor' and acting_for == 'lender':
            existing_active = DealParty.objects.filter(
                deal=deal_party.deal,
                party_type='solicitor',
                acting_for_party='lender',
                is_active_lender_solicitor=True,
                appointment_status='active'
            ).exclude(id=deal_party.id).first()
            
            if existing_active:
                return Response(
                    {'error': 'Only one active lender solicitor allowed per deal. Please contact the lender to replace the existing solicitor first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        deal_party.acting_for_party = acting_for
        deal_party.firm_name = firm_name or ''
        deal_party.sra_number = sra_number or ''
        deal_party.rics_number = rics_number or ''
        deal_party.confirmed_at = timezone.now()
        deal_party.appointment_status = 'confirmed'
        
        # Set as active lender solicitor if applicable
        if deal_party.party_type == 'solicitor' and acting_for == 'lender':
            # Deactivate any existing active lender solicitor
            DealParty.objects.filter(
                deal=deal_party.deal,
                party_type='solicitor',
                acting_for_party='lender',
                is_active_lender_solicitor=True
            ).exclude(id=deal_party.id).update(is_active_lender_solicitor=False)
            
            deal_party.is_active_lender_solicitor = True
        
        deal_party.appointment_status = 'active'
        deal_party.access_granted_at = timezone.now()
        deal_party.save()
        
        # Log audit event
        AuditEvent.objects.create(
            deal=deal_party.deal,
            actor_user=request.user,
            event_type='consultant_confirmed',
            object_type='deal_party',
            object_id=deal_party.id,
            metadata={
                'party_type': deal_party.party_type,
                'acting_for': acting_for,
            }
        )
        
        return Response(DealPartySerializer(deal_party).data)
    
    @action(detail=True, methods=['post'])
    def replace_solicitor(self, request, pk=None):
        """Replace an active lender solicitor (requires reason and audit log)."""
        deal_party = self.get_object()
        
        # Only lender can replace solicitor
        user = request.user
        if not hasattr(user, 'lenderprofile') or deal_party.deal.lender != user.lenderprofile:
            if not IsAdmin().has_permission(self.request, self):
                return Response(
                    {'error': 'Only lender can replace solicitor'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        if deal_party.party_type != 'solicitor' or not deal_party.is_active_lender_solicitor:
            return Response(
                {'error': 'This is not an active lender solicitor'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        replacement_reason = request.data.get('reason', '')
        if not replacement_reason:
            return Response(
                {'error': 'Reason is required for solicitor replacement'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Deactivate current solicitor
        deal_party.is_active_lender_solicitor = False
        deal_party.appointment_status = 'removed'
        deal_party.removed_at = timezone.now()
        deal_party.removal_reason = replacement_reason
        deal_party.save()
        
        # Log audit event
        AuditEvent.objects.create(
            deal=deal_party.deal,
            actor_user=user,
            event_type='solicitor_replaced',
            object_type='deal_party',
            object_id=deal_party.id,
            metadata={
                'reason': replacement_reason,
                'solicitor_name': deal_party.user_name or 'Unknown',
            }
        )
        
        return Response(DealPartySerializer(deal_party).data)


class DealTaskViewSet(viewsets.ModelViewSet):
    """ViewSet for DealTask management."""
    
    serializer_class = DealTaskSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter tasks based on user's deal access."""
        user = self.request.user
        deal_id_param = self.request.query_params.get('deal_id')
        stage_id = self.request.query_params.get('stage_id')
        
        qs = DealTask.objects.select_related('deal', 'stage', 'assignee_user')
        
        if deal_id_param:
            # Look up Deal by deal_id (string) not id (integer)
            try:
                deal = Deal.objects.get(deal_id=deal_id_param)
                qs = qs.filter(deal=deal)
            except Deal.DoesNotExist:
                qs = qs.none()
        if stage_id:
            qs = qs.filter(stage_id=stage_id)
        
        # Filter by user access to deals
        if not IsAdmin().has_permission(self.request, self):
            deals = Deal.objects.filter(
                Q(lender__user=user) |
                Q(borrower_company__user=user) |
                Q(parties__user=user, parties__is_active=True)
            ).distinct()
            qs = qs.filter(deal__in=deals)
        
        return qs
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark a task as complete."""
        task = self.get_object()
        task.status = 'completed'
        task.completed_at = timezone.now()
        task.save()
        
        # Check if stage can be advanced
        deal = task.deal
        deal.calculate_readiness_score()
        deal.save()
        
        return Response(DealTaskSerializer(task).data)


class DealCPViewSet(viewsets.ModelViewSet):
    """ViewSet for Conditions Precedent management."""
    
    serializer_class = DealCPSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter CPs based on user's deal access."""
        user = self.request.user
        deal_id_param = self.request.query_params.get('deal_id')
        
        qs = DealCP.objects.select_related('deal', 'approved_by')
        
        if deal_id_param:
            # Look up Deal by deal_id (string) not id (integer)
            try:
                deal = Deal.objects.get(deal_id=deal_id_param)
                qs = qs.filter(deal=deal)
            except Deal.DoesNotExist:
                qs = qs.none()
        
        if not IsAdmin().has_permission(self.request, self):
            deals = Deal.objects.filter(
                Q(lender__user=user) |
                Q(borrower_company__user=user) |
                Q(parties__user=user, parties__is_active=True)
            ).distinct()
            qs = qs.filter(deal__in=deals)
        
        return qs
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a CP."""
        cp = self.get_object()
        cp.status = 'satisfied'
        cp.approved_by = request.user
        cp.approved_at = timezone.now()
        cp.save()
        
        # Update deal readiness
        deal = cp.deal
        deal.calculate_readiness_score()
        deal.save()
        
        return Response(DealCPSerializer(cp).data)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a CP with reason."""
        cp = self.get_object()
        cp.status = 'rejected'
        cp.rejected_reason = request.data.get('reason', '')
        cp.rejected_by = request.user
        cp.rejected_at = timezone.now()
        cp.save()
        
        # Update deal readiness
        deal = cp.deal
        deal.calculate_readiness_score()
        deal.save()
        
        return Response(DealCPSerializer(cp).data)


class DealRequisitionViewSet(viewsets.ModelViewSet):
    """ViewSet for Legal Requisitions."""
    
    serializer_class = DealRequisitionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter requisitions based on user's deal access."""
        user = self.request.user
        deal_id_param = self.request.query_params.get('deal_id')
        
        qs = DealRequisition.objects.select_related('deal', 'raised_by', 'responded_by')
        
        if deal_id_param:
            # Look up Deal by deal_id (string) not id (integer)
            try:
                deal = Deal.objects.get(deal_id=deal_id_param)
                qs = qs.filter(deal=deal)
            except Deal.DoesNotExist:
                qs = qs.none()
        
        if not IsAdmin().has_permission(self.request, self):
            deals = Deal.objects.filter(
                Q(lender__user=user) |
                Q(borrower_company__user=user) |
                Q(parties__user=user, parties__is_active=True)
            ).distinct()
            qs = qs.filter(deal__in=deals)
        
        return qs.order_by('-raised_at')
    
    def perform_create(self, serializer):
        """Set raised_by to lender solicitor and generate requisition_number."""
        from rest_framework.exceptions import ValidationError
        
        deal = serializer.validated_data['deal']
        
        # Find lender solicitor for this deal
        lender_solicitor = DealParty.objects.filter(
            deal=deal,
            party_type='solicitor',
            acting_for_party='lender',
            is_active_lender_solicitor=True
        ).first()
        
        if not lender_solicitor:
            raise ValidationError({
                'error': 'No active lender solicitor found for this deal. Please invite a lender solicitor first.'
            })
        
        # Generate requisition number
        existing_count = DealRequisition.objects.filter(deal=deal).count()
        requisition_number = f"REQ-{existing_count + 1:03d}"
        
        serializer.save(
            raised_by=lender_solicitor,
            requisition_number=requisition_number
        )
    
    @action(detail=True, methods=['post'])
    def respond(self, request, pk=None):
        """Respond to a requisition."""
        requisition = self.get_object()
        response_text = request.data.get('response', '')
        attachments = request.data.get('attachments', [])
        
        requisition.response = response_text
        requisition.responded_by = request.user
        requisition.responded_at = timezone.now()
        requisition.status = 'responded'
        if attachments:
            requisition.attachments = attachments
        requisition.save()
        
        return Response(DealRequisitionSerializer(requisition).data)


class DrawdownViewSet(viewsets.ModelViewSet):
    """ViewSet for Drawdown management (development finance only)."""
    
    serializer_class = DrawdownSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter drawdowns based on user's deal access."""
        user = self.request.user
        deal_id_param = self.request.query_params.get('deal_id')
        
        qs = Drawdown.objects.select_related('deal', 'approved_by')
        
        if deal_id_param:
            # Look up Deal by deal_id (string) not id (integer)
            try:
                deal = Deal.objects.get(deal_id=deal_id_param)
                qs = qs.filter(deal=deal)
            except Deal.DoesNotExist:
                qs = qs.none()
        
        if not IsAdmin().has_permission(self.request, self):
            deals = Deal.objects.filter(
                Q(lender__user=user) |
                Q(borrower_company__user=user) |
                Q(parties__user=user, parties__is_active=True)
            ).distinct()
            qs = qs.filter(deal__in=deals)
        
        return qs.order_by('sequence_number')
    
    def perform_create(self, serializer):
        """Set sequence_number if not provided and ensure proper ordering."""
        deal = serializer.validated_data['deal']
        
        # If sequence_number not provided, calculate next number
        if 'sequence_number' not in serializer.validated_data or not serializer.validated_data.get('sequence_number'):
            existing_max = Drawdown.objects.filter(deal=deal).aggregate(
                max_seq=Max('sequence_number')
            )['max_seq'] or 0
            serializer.validated_data['sequence_number'] = existing_max + 1
        
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a drawdown request (lender only, after MS approval)."""
        drawdown = self.get_object()
        
        # Only lender can approve
        if not hasattr(request.user, 'lenderprofile') or drawdown.deal.lender != request.user.lenderprofile:
            if not IsAdmin().has_permission(self.request, self):
                return Response(
                    {'error': 'Only lender can approve drawdowns'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Check MS has approved
        if drawdown.ms_review_status != 'ms_approved':
            return Response(
                {'error': 'Monitoring Surveyor must approve before lender can approve'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        drawdown.lender_approval_status = 'approved'
        drawdown.approved_by = request.user
        drawdown.approved_at = timezone.now()
        drawdown.save()
        
        # Log audit event
        AuditEvent.objects.create(
            deal=drawdown.deal,
            actor_user=request.user,
            event_type='drawdown_lender_approved',
            object_type='drawdown',
            object_id=drawdown.id,
            metadata={'drawdown_sequence': drawdown.sequence_number}
        )
        
        return Response(DrawdownSerializer(drawdown).data)
    
    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_documents(self, request, pk=None):
        """Upload supporting documents for a drawdown with categorization."""
        from documents.models import Document
        from rest_framework.exceptions import ValidationError
        
        drawdown = self.get_object()
        files = request.FILES.getlist('files')
        document_category = request.data.get('document_category', 'drawdown_other')
        document_type_description = request.data.get('document_type_description', '')
        
        if not files:
            raise ValidationError({'error': 'No files provided'})
        
        # Validate category
        valid_categories = [
            'drawdown_progress_reports',
            'drawdown_photos',
            'drawdown_consultants_building_control',
            'drawdown_other'
        ]
        if document_category not in valid_categories:
            raise ValidationError({'error': f'document_category must be one of: {", ".join(valid_categories)}'})
        
        # Look up deal by deal_id
        deal = drawdown.deal
        
        uploaded_doc_links = []
        for file in files:
            # Create document record
            document = Document.objects.create(
                owner=request.user,
                file_name=file.name,
                file_size=file.size,
                file_type=file.content_type or 'application/octet-stream',
                upload_path=f"drawdowns/{drawdown.id}/{file.name}",
            )
            
            # Link to deal with drawdown reference
            doc_link = DealDocumentLink.objects.create(
                deal=deal,
                drawdown=drawdown,
                document=document,
                document_category=document_category,
                document_type_description=document_type_description,
                visibility='shared',
                uploaded_by=request.user,
            )
            
            uploaded_doc_links.append(DealDocumentLinkSerializer(doc_link).data)
        
        # Log audit event
        AuditEvent.objects.create(
            deal=deal,
            actor_user=request.user,
            event_type='document_uploaded',
            object_type='drawdown',
            object_id=drawdown.id,
            metadata={
                'drawdown_sequence': drawdown.sequence_number,
                'documents_count': len(uploaded_doc_links),
                'document_category': document_category,
                'document_names': [doc['document_file_name'] for doc in uploaded_doc_links]
            }
        )
        
        return Response({
            'message': f'Successfully uploaded {len(uploaded_doc_links)} document(s)',
            'documents': uploaded_doc_links
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def ms_start_review(self, request, pk=None):
        """MS starts review of drawdown."""
        drawdown = self.get_object()
        user = request.user
        
        # Check if user is MS for this deal
        ms_party = DealParty.objects.filter(
            deal=drawdown.deal,
            party_type='monitoring_surveyor',
            user=user,
            appointment_status='active'
        ).first()
        
        if not ms_party:
            if not IsAdmin().has_permission(self.request, self):
                return Response(
                    {'error': 'Only Monitoring Surveyor can review drawdowns'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        drawdown.ms_review_status = 'under_review'
        drawdown.ms_reviewed_by = user
        drawdown.ms_reviewed_at = timezone.now()
        drawdown.save()
        
        return Response(DrawdownSerializer(drawdown).data)
    
    @action(detail=True, methods=['post'])
    def ms_schedule_site_visit(self, request, pk=None):
        """MS schedules site visit."""
        drawdown = self.get_object()
        user = request.user
        visit_date = request.data.get('visit_date')
        
        # Check if user is MS
        ms_party = DealParty.objects.filter(
            deal=drawdown.deal,
            party_type='monitoring_surveyor',
            user=user,
            appointment_status='active'
        ).first()
        
        if not ms_party:
            if not IsAdmin().has_permission(self.request, self):
                return Response(
                    {'error': 'Only Monitoring Surveyor can schedule site visits'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        if visit_date:
            from datetime import datetime
            drawdown.ims_inspection_date = datetime.strptime(visit_date, '%Y-%m-%d').date()
        
        drawdown.ms_review_status = 'site_visit_scheduled'
        drawdown.save()
        
        return Response(DrawdownSerializer(drawdown).data)
    
    @action(detail=True, methods=['post'])
    def ms_complete_site_visit(self, request, pk=None):
        """MS marks site visit as completed."""
        drawdown = self.get_object()
        user = request.user
        
        # Check if user is MS
        ms_party = DealParty.objects.filter(
            deal=drawdown.deal,
            party_type='monitoring_surveyor',
            user=user,
            appointment_status='active'
        ).first()
        
        if not ms_party:
            if not IsAdmin().has_permission(self.request, self):
                return Response(
                    {'error': 'Only Monitoring Surveyor can complete site visits'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        drawdown.ms_review_status = 'site_visit_completed'
        drawdown.save()
        
        return Response(DrawdownSerializer(drawdown).data)
    
    @action(detail=True, methods=['post'])
    def ms_approve(self, request, pk=None):
        """MS approves drawdown for lender review."""
        drawdown = self.get_object()
        user = request.user
        notes = request.data.get('notes', '')
        
        # Check if user is MS
        ms_party = DealParty.objects.filter(
            deal=drawdown.deal,
            party_type='monitoring_surveyor',
            user=user,
            appointment_status='active'
        ).first()
        
        if not ms_party:
            if not IsAdmin().has_permission(self.request, self):
                return Response(
                    {'error': 'Only Monitoring Surveyor can approve drawdowns'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        drawdown.ms_review_status = 'ms_approved'
        drawdown.ms_approved_at = timezone.now()
        drawdown.ms_notes = notes
        drawdown.lender_approval_status = 'lender_review'
        drawdown.save()
        
        # Log audit event
        AuditEvent.objects.create(
            deal=drawdown.deal,
            actor_user=user,
            event_type='drawdown_ms_approved',
            object_type='drawdown',
            object_id=drawdown.id,
            metadata={'drawdown_sequence': drawdown.sequence_number, 'notes': notes}
        )
        
        return Response(DrawdownSerializer(drawdown).data)
    
    @action(detail=True, methods=['post'])
    def ms_reject(self, request, pk=None):
        """MS rejects drawdown."""
        drawdown = self.get_object()
        user = request.user
        reason = request.data.get('reason', '')
        
        # Check if user is MS
        ms_party = DealParty.objects.filter(
            deal=drawdown.deal,
            party_type='monitoring_surveyor',
            user=user,
            appointment_status='active'
        ).first()
        
        if not ms_party:
            if not IsAdmin().has_permission(self.request, self):
                return Response(
                    {'error': 'Only Monitoring Surveyor can reject drawdowns'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        drawdown.ms_review_status = 'ms_rejected'
        drawdown.ms_notes = reason
        drawdown.save()
        
        return Response(DrawdownSerializer(drawdown).data)


class DealMessageThreadViewSet(viewsets.ModelViewSet):
    """ViewSet for Deal message threads."""
    
    serializer_class = DealMessageThreadSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter threads based on user's deal access."""
        user = self.request.user
        deal_id_param = self.request.query_params.get('deal_id')
        
        qs = DealMessageThread.objects.select_related('deal', 'created_by')
        
        if deal_id_param:
            # Look up Deal by deal_id (string) not id (integer)
            try:
                deal = Deal.objects.get(deal_id=deal_id_param)
                qs = qs.filter(deal=deal)
            except Deal.DoesNotExist:
                qs = qs.none()
        
        if not IsAdmin().has_permission(self.request, self):
            deals = Deal.objects.filter(
                Q(lender__user=user) |
                Q(borrower_company__user=user) |
                Q(parties__user=user, parties__is_active=True)
            ).distinct()
            qs = qs.filter(deal__in=deals)
        
        return qs


class DealMessageViewSet(viewsets.ModelViewSet):
    """ViewSet for Deal messages."""
    
    serializer_class = DealMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter messages based on thread access."""
        thread_id = self.request.query_params.get('thread_id')
        
        qs = DealMessage.objects.select_related('thread', 'sender')
        
        if thread_id:
            qs = qs.filter(thread_id=thread_id)
        
        # Order by created_at ascending for WhatsApp-style display
        return qs.order_by('created_at')
    
    def perform_create(self, serializer):
        """Set sender when creating message."""
        serializer.save(sender=self.request.user)


class LawFirmViewSet(viewsets.ModelViewSet):
    """ViewSet for Law Firm management."""
    
    serializer_class = LawFirmSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Lenders see their panel firms, admin sees all."""
        user = self.request.user
        
        if IsAdmin().has_permission(self.request, self):
            return LawFirm.objects.all()
        
        if hasattr(user, 'lenderprofile'):
            # Return firms in lender's panel
            panel_firm_ids = LawFirmPanelMembership.objects.filter(
                lender=user.lenderprofile,
                is_active=True
            ).values_list('law_firm_id', flat=True)
            return LawFirm.objects.filter(id__in=panel_firm_ids)
        
        return LawFirm.objects.none()


class LawFirmPanelMembershipViewSet(viewsets.ModelViewSet):
    """ViewSet for Law Firm Panel management."""
    
    serializer_class = LawFirmPanelMembershipSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Lenders see their panel memberships."""
        user = self.request.user
        
        if IsAdmin().has_permission(self.request, self):
            return LawFirmPanelMembership.objects.select_related('lender', 'law_firm').all()
        
        if hasattr(user, 'lenderprofile'):
            return LawFirmPanelMembership.objects.filter(
                lender=user.lenderprofile
            ).select_related('lender', 'law_firm')
        
        return LawFirmPanelMembership.objects.none()


class DealDocumentLinkViewSet(viewsets.ModelViewSet):
    """ViewSet for Deal Document management with secure access."""
    
    serializer_class = DealDocumentLinkSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def get_queryset(self):
        """Filter documents based on user's deal access and visibility."""
        user = self.request.user
        deal_id_param = self.request.query_params.get('deal_id')
        category = self.request.query_params.get('category')
        
        qs = DealDocumentLink.objects.select_related('deal', 'document', 'uploaded_by')
        
        if deal_id_param:
            # Look up Deal by deal_id (string) not id (integer)
            try:
                deal = Deal.objects.get(deal_id=deal_id_param)
                qs = qs.filter(deal=deal)
            except Deal.DoesNotExist:
                qs = qs.none()
        if category:
            qs = qs.filter(document_category=category)
        
        # Filter by user access to deals
        if not IsAdmin().has_permission(self.request, self):
            deals = Deal.objects.filter(
                Q(lender__user=user) |
                Q(borrower_company__user=user) |
                Q(parties__user=user, parties__is_active=True)
            ).distinct()
            qs = qs.filter(deal__in=deals)
        
        return qs.order_by('-uploaded_at')
    
    @action(detail=True, methods=['get'])
    def view(self, request, pk=None):
        """View document with step-up authentication for sensitive docs."""
        doc_link = self.get_object()
        user = request.user
        
        # Check visibility permissions
        if not self._user_can_view_document(user, doc_link):
            return Response(
                {'error': 'You do not have permission to view this document'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # For sensitive categories, require step-up auth
        sensitive_categories = ['compliance', 'financial']
        if doc_link.document_category in sensitive_categories:
            session_key = request.headers.get('X-Step-Up-Session-Key') or request.query_params.get('session_key')
            if not session_key or not self._verify_step_up(user, session_key):
                return Response(
                    {'error': 'Step-up authentication required', 'requires_step_up': True},
                    status=status.HTTP_401_UNAUTHORIZED
                )
        
        # Log access in audit
        AuditEvent.objects.create(
            deal=doc_link.deal,
            actor_user=user,
            event_type='document_viewed',
            object_type='deal_document',
            object_id=doc_link.id,
            metadata={'document_name': doc_link.document.file_name, 'category': doc_link.document_category}
        )
        
        # Return document view URL (in production, generate signed S3 URL)
        return Response({
            'document_id': doc_link.document.id,
            'file_name': doc_link.document.file_name,
            'view_url': f'/api/documents/{doc_link.document.id}/view/'
        })
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download document with step-up authentication."""
        doc_link = self.get_object()
        user = request.user
        
        # Check visibility permissions
        if not self._user_can_view_document(user, doc_link):
            return Response(
                {'error': 'You do not have permission to download this document'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # For sensitive categories, require step-up auth
        sensitive_categories = ['compliance', 'financial']
        if doc_link.document_category in sensitive_categories:
            session_key = request.headers.get('X-Step-Up-Session-Key') or request.query_params.get('session_key')
            if not session_key or not self._verify_step_up(user, session_key):
                return Response(
                    {'error': 'Step-up authentication required', 'requires_step_up': True},
                    status=status.HTTP_401_UNAUTHORIZED
                )
        
        # Log access in audit
        AuditEvent.objects.create(
            deal=doc_link.deal,
            actor_user=user,
            event_type='document_downloaded',
            object_type='deal_document',
            object_id=doc_link.id,
            metadata={'document_name': doc_link.document.file_name, 'category': doc_link.document_category}
        )
        
        # Return download URL (in production, generate signed S3 URL)
        return Response({
            'document_id': doc_link.document.id,
            'file_name': doc_link.document.file_name,
            'download_url': f'/api/documents/{doc_link.document.id}/download/'
        })
    
    def _user_can_view_document(self, user, doc_link):
        """Check if user can view this document based on visibility rules."""
        deal = doc_link.deal
        
        # Admin can see all
        if IsAdmin().has_permission(self.request, self):
            return True
        
        # Check visibility setting
        if doc_link.visibility == 'borrower_only':
            return hasattr(user, 'borrowerprofile') and deal.borrower_company == user.borrowerprofile
        elif doc_link.visibility == 'lender_only':
            return hasattr(user, 'lenderprofile') and deal.lender == user.lenderprofile
        elif doc_link.visibility == 'shared':
            return (hasattr(user, 'borrowerprofile') and deal.borrower_company == user.borrowerprofile) or \
                   (hasattr(user, 'lenderprofile') and deal.lender == user.lenderprofile)
        elif doc_link.visibility == 'consultant_scoped':
            party = DealParty.objects.filter(deal=deal, user=user, appointment_status='active').first()
            return party and doc_link.visible_to_consultants.filter(id=party.id).exists()
        elif doc_link.visibility == 'legal_only':
            party = DealParty.objects.filter(deal=deal, user=user, appointment_status='active').first()
            return party and party.party_type in ['solicitor', 'lender_solicitor', 'borrower_solicitor']
        
        return False
    
    def _verify_step_up(self, user, session_key):
        """Verify step-up authentication session."""
        try:
            from borrowers.models_borrower_profile import StepUpAuthentication
            step_up = StepUpAuthentication.objects.filter(
                user=user,
                session_key=session_key
            ).order_by('-authenticated_at').first()
            
            return step_up and step_up.is_valid()
        except Exception:
            return False


# ============================================================================
# Provider Workflow ViewSets
# ============================================================================

class ProviderEnquiryViewSet(viewsets.ModelViewSet):
    """ViewSet for ProviderEnquiry (quote requests)."""
    
    serializer_class = ProviderEnquirySerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter enquiries based on user role."""
        user = self.request.user
        deal_id = self.request.query_params.get('deal_id')
        role_type = self.request.query_params.get('role_type')
        
        qs = ProviderEnquiry.objects.select_related('deal', 'provider_firm').all()
        
        # Filter by deal
        if deal_id:
            try:
                deal = Deal.objects.get(deal_id=deal_id)
                qs = qs.filter(deal=deal)
            except Deal.DoesNotExist:
                return ProviderEnquiry.objects.none()
        
        # Filter by role type
        if role_type:
            qs = qs.filter(role_type=role_type)
        
        # Lender sees enquiries for their deals
        if hasattr(user, 'lenderprofile'):
            qs = qs.filter(deal__lender=user.lenderprofile)
        
        # Borrower sees enquiries for their deals
        elif hasattr(user, 'borrowerprofile'):
            qs = qs.filter(deal__borrower_company=user.borrowerprofile)
        
        # Consultant sees enquiries sent to them
        elif hasattr(user, 'consultantprofile'):
            qs = qs.filter(provider_firm=user.consultantprofile)
        
        # Admin sees all
        elif user.is_staff:
            pass
        
        else:
            return ProviderEnquiry.objects.none()
        
        return qs.order_by('-sent_at')
    
    @action(detail=True, methods=['post'])
    def mark_viewed(self, request, pk=None):
        """Mark enquiry as viewed by provider."""
        enquiry = self.get_object()
        
        # Check permissions - only provider can mark as viewed
        if not hasattr(request.user, 'consultantprofile') or enquiry.provider_firm != request.user.consultantprofile:
            return Response(
                {'error': 'Only the provider can mark enquiry as viewed'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if not enquiry.viewed_at:
            enquiry.viewed_at = timezone.now()
            if enquiry.status == 'sent':
                enquiry.status = 'viewed'
            enquiry.save()
        
        return Response(ProviderEnquirySerializer(enquiry).data)
    
    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Acknowledge enquiry and provide expected quote date."""
        enquiry = self.get_object()
        
        # Check permissions - only provider can acknowledge
        if not hasattr(request.user, 'consultantprofile') or enquiry.provider_firm != request.user.consultantprofile:
            return Response(
                {'error': 'Only the provider can acknowledge enquiry'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        expected_quote_date = request.data.get('expected_quote_date')
        acknowledgment_notes = request.data.get('acknowledgment_notes', '')
        
        if not expected_quote_date:
            return Response(
                {'error': 'expected_quote_date is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Parse date
        from datetime import datetime
        try:
            if isinstance(expected_quote_date, str):
                expected_date = datetime.strptime(expected_quote_date, '%Y-%m-%d').date()
            else:
                expected_date = expected_quote_date
        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update enquiry
        enquiry.acknowledged_at = timezone.now()
        enquiry.expected_quote_date = expected_date
        enquiry.acknowledgment_notes = acknowledgment_notes
        if enquiry.status in ['sent', 'viewed']:
            # Keep status as 'viewed' or 'sent' - acknowledgment doesn't change status
            pass
        enquiry.save()
        
        # TODO: Send notification to lender and borrower about acknowledgment
        # Using existing notification system
        
        return Response(ProviderEnquirySerializer(enquiry).data)
    
    @action(detail=False, methods=['post'], url_path='request-quotes')
    def request_quotes(self, request):
        """Create ProviderEnquiry records for shortlisted providers."""
        from .provider_matching_service import DealProviderMatchingService
        from datetime import timedelta
        
        deal_id = request.data.get('deal_id')
        role_type = request.data.get('role_type')
        provider_ids = request.data.get('provider_ids', [])  # Optional: specific providers
        limit = request.data.get('limit', 5)  # Default top 5
        quote_due_days = request.data.get('quote_due_days', 7)  # Default 7 days
        
        if not deal_id or not role_type:
            return Response(
                {'error': 'deal_id and role_type are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            deal = Deal.objects.get(deal_id=deal_id)
        except Deal.DoesNotExist:
            return Response(
                {'error': 'Deal not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check permissions - only lender can request quotes
        if not hasattr(request.user, 'lenderprofile') or deal.lender != request.user.lenderprofile:
            if not IsAdmin().has_permission(request, self):
                return Response(
                    {'error': 'Only the lender can request quotes'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # For solicitor role: check if borrower already has a solicitor
        if role_type == 'solicitor':
            borrower_profile = deal.borrower_company
            if borrower_profile and (borrower_profile.solicitor_firm_name or borrower_profile.solicitor_contact_email):
                # Check if solicitor is already invited to the deal
                existing_solicitor = DealParty.objects.filter(
                    deal=deal,
                    party_type='solicitor',
                    acting_for_party='borrower'
                ).first()
                
                if existing_solicitor:
                    return Response(
                        {
                            'error': 'Borrower already has a solicitor for this deal',
                            'message': f'The borrower has a preferred solicitor ({borrower_profile.solicitor_firm_name or borrower_profile.solicitor_contact_email}) who has been invited to this deal.',
                            'solicitor_info': {
                                'firm_name': borrower_profile.solicitor_firm_name,
                                'contact_email': borrower_profile.solicitor_contact_email,
                                'contact_name': borrower_profile.solicitor_contact_name,
                            }
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
        
        # Helper functions for creating ranges
        def get_loan_amount_range(amount):
            """Convert exact amount to range for privacy."""
            if not amount:
                return None
            try:
                amount = float(amount)
                if amount < 100000:
                    return '< £100k'
                elif amount < 500000:
                    return '£100k - £500k'
                elif amount < 1000000:
                    return '£500k - £1M'
                elif amount < 5000000:
                    return '£1M - £5M'
                else:
                    return '> £5M'
            except (ValueError, TypeError):
                return None
        
        def get_ltv_range(ltv):
            """Convert exact LTV to range for privacy."""
            if not ltv:
                return None
            try:
                ltv = float(ltv)
                if ltv < 50:
                    return '< 50%'
                elif ltv < 65:
                    return '50% - 65%'
                elif ltv < 75:
                    return '65% - 75%'
                else:
                    return '> 75%'
            except (ValueError, TypeError):
                return None
        
        # Get matching providers
        matching_service = DealProviderMatchingService()
        
        if provider_ids:
            # Use specified providers
            providers = ConsultantProfile.objects.filter(
                id__in=provider_ids,
                is_active=True,
                is_verified=True
            )
            matches = [{'provider': p, 'match_score': 100.0} for p in providers]
        else:
            # Find matching providers
            matches = matching_service.find_matching_providers(deal, role_type, limit=limit)
        
        # Create comprehensive deal summary snapshot (redacted for providers - no sensitive personal/financial data)
        project = deal.application.project if deal.application and deal.application.project else None
        borrower = deal.borrower_company
        lender = deal.lender
        product = deal.application.product if deal.application and deal.application.product else None
        
        deal_summary = {
            'deal_id': deal.deal_id,
            'facility_type': deal.facility_type,
            'facility_type_display': deal.get_facility_type_display(),
            'jurisdiction': deal.jurisdiction,
            
            # Project information (non-sensitive)
            'project': {
                'property_type': project.property_type if project else None,
                'property_type_display': project.get_property_type_display() if project else None,
                'description': project.description if project else None,
                'address': project.address if project else None,
                'town': project.town if project else None,
                'county': project.county if project else None,
                'postcode': project.postcode if project else None,
                'development_extent': project.development_extent if project else None,
                'development_extent_display': project.get_development_extent_display() if project else None,
                'tenure': project.tenure if project else None,
                'tenure_display': project.get_tenure_display() if project else None,
                'planning_permission': project.planning_permission if project else None,
                'planning_authority': project.planning_authority if project else None,
                'planning_reference': project.planning_reference if project else None,
                'planning_description': project.planning_description if project else None,
                'unit_counts': project.unit_counts if project else {},
                'gross_internal_area': float(project.gross_internal_area) if project and project.gross_internal_area else None,
                'purchase_price': float(project.purchase_price) if project and project.purchase_price else None,
                'build_cost': float(project.build_cost) if project and project.build_cost else None,
                'current_market_value': float(project.current_market_value) if project and project.current_market_value else None,
                'gross_development_value': float(project.gross_development_value) if project and project.gross_development_value else None,
                'repayment_method': project.repayment_method if project else None,
                'repayment_method_display': project.get_repayment_method_display() if project else None,
            } if project else {},
            
            # Borrower company information (non-sensitive - company name only, no personal data)
            'borrower': {
                'company_name': borrower.company_name if borrower else None,
                'trading_name': borrower.trading_name if borrower else None,
            } if borrower else {},
            
            # Lender information (non-sensitive - public info only)
            'lender': {
                'organisation_name': lender.organisation_name if lender else None,
                'contact_email': lender.contact_email if lender else None,
                'contact_phone': lender.contact_phone if lender else None,
                'website': lender.website if lender else None,
            } if lender else {},
            
            # Product information (non-sensitive)
            'product': {
                'name': product.name if product else None,
                'funding_type': product.funding_type if product else None,
                'funding_type_display': product.get_funding_type_display() if product else None,
                'description': product.description[:500] if product and product.description else None,  # Truncate long descriptions
            } if product else {},
            
            # Deal commercial terms (ranges/indicators only, not exact amounts)
            'commercial_indicators': {
                'loan_amount_range': get_loan_amount_range(deal.commercial_terms.get('loan_amount') if deal.commercial_terms else None),
                'term_months': deal.commercial_terms.get('term_months') if deal.commercial_terms else None,
                'ltv_range': get_ltv_range(deal.commercial_terms.get('ltv_ratio') if deal.commercial_terms else None),
            } if deal.commercial_terms else {},
        }
        
        # Create enquiries
        created_enquiries = []
        quote_due_at = timezone.now() + timedelta(days=quote_due_days)
        
        for match in matches[:limit]:
            provider = match['provider']
            
            # Check if enquiry already exists
            existing = ProviderEnquiry.objects.filter(
                deal=deal,
                role_type=role_type,
                provider_firm=provider
            ).first()
            
            if existing:
                continue
            
            enquiry = ProviderEnquiry.objects.create(
                deal=deal,
                role_type=role_type,
                provider_firm=provider,
                status='sent',
                quote_due_at=quote_due_at,
                deal_summary_snapshot=deal_summary,
                lender_notes=request.data.get('lender_notes', ''),
            )
            created_enquiries.append(enquiry)
            
            # TODO: Send notification to provider (email/in-app)
            # Using existing notification system
        
        return Response({
            'message': f'Created {len(created_enquiries)} enquiry(ies)',
            'enquiries': ProviderEnquirySerializer(created_enquiries, many=True).data,
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'], url_path='matching-providers')
    def matching_providers(self, request):
        """Get list of matching providers for a deal/role (for shortlisting)."""
        from .provider_matching_service import DealProviderMatchingService
        
        deal_id = request.query_params.get('deal_id')
        role_type = request.query_params.get('role_type')
        limit = int(request.query_params.get('limit', 20))
        
        if not deal_id or not role_type:
            return Response(
                {'error': 'deal_id and role_type are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            deal = Deal.objects.get(deal_id=deal_id)
        except Deal.DoesNotExist:
            return Response(
                {'error': 'Deal not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check permissions
        if not hasattr(request.user, 'lenderprofile') or deal.lender != request.user.lenderprofile:
            if not IsAdmin().has_permission(request, self):
                return Response(
                    {'error': 'Only the lender can view matching providers'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # For solicitor role: check if borrower already has a solicitor
        if role_type == 'solicitor':
            borrower_profile = deal.borrower_company
            if borrower_profile and (borrower_profile.solicitor_firm_name or borrower_profile.solicitor_contact_email):
                # Check if solicitor is already invited to the deal
                existing_solicitor = DealParty.objects.filter(
                    deal=deal,
                    party_type='solicitor',
                    acting_for_party='borrower'
                ).first()
                
                if existing_solicitor:
                    return Response({
                        'matching_providers': [],
                        'deal_id': deal_id,
                        'role_type': role_type,
                        'borrower_has_solicitor': True,
                        'solicitor_info': {
                            'firm_name': borrower_profile.solicitor_firm_name,
                            'contact_email': borrower_profile.solicitor_contact_email,
                            'contact_name': borrower_profile.solicitor_contact_name,
                            'sra_number': borrower_profile.solicitor_sra_number,
                        },
                        'message': 'Borrower has a preferred solicitor who has been invited to this deal.',
                    })
        
        # Get matching providers
        matching_service = DealProviderMatchingService()
        matches = matching_service.find_matching_providers(deal, role_type, limit=limit)
        
        # Serialize results
        from consultants.serializers import ConsultantProfileSerializer
        results = []
        for match in matches:
            results.append({
                'provider': ConsultantProfileSerializer(match['provider']).data,
                'match_score': match['match_score'],
            })
        
        return Response({
            'matching_providers': results,
            'deal_id': deal_id,
            'role_type': role_type,
            'borrower_has_solicitor': False,
        })


class ProviderQuoteViewSet(viewsets.ModelViewSet):
    """ViewSet for ProviderQuote."""
    
    serializer_class = ProviderQuoteSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter quotes based on user role."""
        user = self.request.user
        enquiry_id = self.request.query_params.get('enquiry_id')
        deal_id = self.request.query_params.get('deal_id')
        role_type = self.request.query_params.get('role_type')
        
        qs = ProviderQuote.objects.select_related('enquiry', 'enquiry__deal', 'enquiry__provider_firm').all()
        
        if enquiry_id:
            qs = qs.filter(enquiry_id=enquiry_id)
        
        if deal_id:
            try:
                deal = Deal.objects.get(deal_id=deal_id)
                qs = qs.filter(enquiry__deal=deal)
            except Deal.DoesNotExist:
                return ProviderQuote.objects.none()
        
        if role_type:
            qs = qs.filter(role_type=role_type)
        
        # Lender sees quotes for their deals
        if hasattr(user, 'lenderprofile'):
            qs = qs.filter(enquiry__deal__lender=user.lenderprofile)
        
        # Borrower sees quotes for their deals
        elif hasattr(user, 'borrowerprofile'):
            qs = qs.filter(enquiry__deal__borrower_company=user.borrowerprofile)
        
        # Consultant sees their own quotes
        elif hasattr(user, 'consultantprofile'):
            qs = qs.filter(enquiry__provider_firm=user.consultantprofile)
        
        # Admin sees all
        elif user.is_staff:
            pass
        
        else:
            return ProviderQuote.objects.none()
        
        return qs.order_by('-submitted_at')
    
    def perform_create(self, serializer):
        """Create quote and update enquiry status."""
        quote = serializer.save(status='submitted')
        
        # Update enquiry status
        enquiry = quote.enquiry
        if enquiry.status == 'sent' or enquiry.status == 'viewed':
            enquiry.status = 'quoted'
            enquiry.save()
        
        # TODO: Send notification to lender and borrower


class DealProviderSelectionViewSet(viewsets.ModelViewSet):
    """ViewSet for DealProviderSelection."""
    
    serializer_class = DealProviderSelectionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter selections based on user role."""
        user = self.request.user
        deal_id = self.request.query_params.get('deal_id')
        role_type = self.request.query_params.get('role_type')
        
        qs = DealProviderSelection.objects.select_related('deal', 'provider_firm', 'quote').all()
        
        if deal_id:
            try:
                deal = Deal.objects.get(deal_id=deal_id)
                qs = qs.filter(deal=deal)
            except Deal.DoesNotExist:
                return DealProviderSelection.objects.none()
        
        if role_type:
            qs = qs.filter(role_type=role_type)
        
        # Lender sees selections for their deals
        if hasattr(user, 'lenderprofile'):
            qs = qs.filter(deal__lender=user.lenderprofile)
        
        # Borrower sees selections for their deals
        elif hasattr(user, 'borrowerprofile'):
            qs = qs.filter(deal__borrower_company=user.borrowerprofile)
        
        # Consultant sees selections where they are selected
        elif hasattr(user, 'consultantprofile'):
            qs = qs.filter(provider_firm=user.consultantprofile)
        
        # Admin sees all
        elif user.is_staff:
            pass
        
        else:
            return DealProviderSelection.objects.none()
        
        return qs.order_by('deal', 'role_type')
    
    def perform_create(self, serializer):
        """Create selection and handle workflow."""
        selection = serializer.save(selected_by=self.request.user)
        
        # Reject other quotes for the same role
        from .models import ProviderQuote
        other_quotes = ProviderQuote.objects.filter(
            enquiry__deal=selection.deal,
            role_type=selection.role_type,
            status__in=['submitted', 'under_review']
        ).exclude(id=selection.quote.id if selection.quote else None)
        
        for quote in other_quotes:
            quote.status = 'declined'
            quote.save()
        
        # Create DealParty if not exists
        DealParty.objects.get_or_create(
            deal=selection.deal,
            consultant_profile=selection.provider_firm,
            party_type=selection.role_type,
            defaults={
                'acting_for_party': selection.acting_for_party,
                'appointment_status': 'invited',
            }
        )
        
        # Create ProviderStageInstance
        ProviderStageInstance.objects.get_or_create(
            deal=selection.deal,
            role_type=selection.role_type,
            provider_firm=selection.provider_firm,
            defaults={
                'current_stage': 'instructed',
            }
        )
        
        # Update quote status if provided
        if selection.quote:
            selection.quote.status = 'accepted'
            selection.quote.accepted_at = timezone.now()
            selection.quote.save()
        
        # TODO: Send notifications


class ProviderStageInstanceViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for ProviderStageInstance (read-only for now)."""
    
    serializer_class = ProviderStageInstanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter stage instances based on user role."""
        user = self.request.user
        deal_id = self.request.query_params.get('deal_id')
        role_type = self.request.query_params.get('role_type')
        
        qs = ProviderStageInstance.objects.select_related('deal', 'provider_firm').all()
        
        if deal_id:
            try:
                deal = Deal.objects.get(deal_id=deal_id)
                qs = qs.filter(deal=deal)
            except Deal.DoesNotExist:
                return ProviderStageInstance.objects.none()
        
        if role_type:
            qs = qs.filter(role_type=role_type)
        
        # Lender sees stages for their deals
        if hasattr(user, 'lenderprofile'):
            qs = qs.filter(deal__lender=user.lenderprofile)
        
        # Borrower sees stages for their deals
        elif hasattr(user, 'borrowerprofile'):
            qs = qs.filter(deal__borrower_company=user.borrowerprofile)
        
        # Consultant sees their own stages
        elif hasattr(user, 'consultantprofile'):
            qs = qs.filter(provider_firm=user.consultantprofile)
        
        # Admin sees all
        elif user.is_staff:
            pass
        
        else:
            return ProviderStageInstance.objects.none()
        
        return qs.order_by('deal', 'role_type')


class ProviderDeliverableViewSet(viewsets.ModelViewSet):
    """ViewSet for ProviderDeliverable."""
    
    serializer_class = ProviderDeliverableSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def get_queryset(self):
        """Filter deliverables based on user role."""
        user = self.request.user
        deal_id = self.request.query_params.get('deal_id')
        role_type = self.request.query_params.get('role_type')
        
        qs = ProviderDeliverable.objects.select_related('deal', 'provider_firm', 'document').all()
        
        if deal_id:
            try:
                deal = Deal.objects.get(deal_id=deal_id)
                qs = qs.filter(deal=deal)
            except Deal.DoesNotExist:
                return ProviderDeliverable.objects.none()
        
        if role_type:
            qs = qs.filter(role_type=role_type)
        
        # Lender sees deliverables for their deals
        if hasattr(user, 'lenderprofile'):
            qs = qs.filter(deal__lender=user.lenderprofile)
        
        # Borrower sees deliverables for their deals (read-only)
        elif hasattr(user, 'borrowerprofile'):
            qs = qs.filter(deal__borrower_company=user.borrowerprofile)
        
        # Consultant sees their own deliverables
        elif hasattr(user, 'consultantprofile'):
            qs = qs.filter(provider_firm=user.consultantprofile)
        
        # Admin sees all
        elif user.is_staff:
            pass
        
        else:
            return ProviderDeliverable.objects.none()
        
        return qs.order_by('-uploaded_at')
    
    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        """Review a deliverable (approve/reject)."""
        deliverable = self.get_object()
        action = request.data.get('action')  # 'approve' or 'reject'
        review_notes = request.data.get('review_notes', '')
        
        if action not in ['approve', 'reject']:
            return Response(
                {'error': 'action must be "approve" or "reject"'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check permissions - only lender can review
        if not hasattr(request.user, 'lenderprofile') or deliverable.deal.lender != request.user.lenderprofile:
            if not IsAdmin().has_permission(request, self):
                return Response(
                    {'error': 'Only the lender can review deliverables'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        deliverable.status = 'approved' if action == 'approve' else 'rejected'
        deliverable.reviewed_by = request.user
        deliverable.reviewed_at = timezone.now()
        deliverable.review_notes = review_notes
        deliverable.save()
        
        # TODO: Send notification to provider
        
        return Response(ProviderDeliverableSerializer(deliverable).data)


class ProviderAppointmentViewSet(viewsets.ModelViewSet):
    """ViewSet for ProviderAppointment."""
    
    serializer_class = ProviderAppointmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter appointments based on user role."""
        user = self.request.user
        deal_id = self.request.query_params.get('deal_id')
        role_type = self.request.query_params.get('role_type')
        
        qs = ProviderAppointment.objects.select_related('deal', 'provider_firm').all()
        
        if deal_id:
            try:
                deal = Deal.objects.get(deal_id=deal_id)
                qs = qs.filter(deal=deal)
            except Deal.DoesNotExist:
                return ProviderAppointment.objects.none()
        
        if role_type:
            qs = qs.filter(role_type=role_type)
        
        # Lender sees appointments for their deals
        if hasattr(user, 'lenderprofile'):
            qs = qs.filter(deal__lender=user.lenderprofile)
        
        # Borrower sees appointments for their deals
        elif hasattr(user, 'borrowerprofile'):
            qs = qs.filter(deal__borrower_company=user.borrowerprofile)
        
        # Consultant sees their own appointments
        elif hasattr(user, 'consultantprofile'):
            qs = qs.filter(provider_firm=user.consultantprofile)
        
        # Admin sees all
        elif user.is_staff:
            pass
        
        else:
            return ProviderAppointment.objects.none()
        
        return qs.order_by('date_time', '-created_at')
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm an appointment."""
        appointment = self.get_object()
        selected_slot = request.data.get('selected_slot')  # Index or date_time
        
        # Check permissions - borrower or lender can confirm
        is_borrower = hasattr(request.user, 'borrowerprofile') and appointment.deal.borrower_company == request.user.borrowerprofile
        is_lender = hasattr(request.user, 'lenderprofile') and appointment.deal.lender == request.user.lenderprofile
        
        if not (is_borrower or is_lender):
            return Response(
                {'error': 'Only borrower or lender can confirm appointments'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Handle proposed slots
        if appointment.proposed_slots and isinstance(selected_slot, int):
            if 0 <= selected_slot < len(appointment.proposed_slots):
                slot = appointment.proposed_slots[selected_slot]
                appointment.date_time = slot.get('date_time')
                appointment.notes = slot.get('notes', '') + '\n' + appointment.notes
        elif selected_slot:
            # Direct date_time provided
            appointment.date_time = selected_slot
        
        appointment.status = 'confirmed'
        appointment.confirmed_by = request.user
        appointment.confirmed_at = timezone.now()
        appointment.save()
        
        # TODO: Send notification to provider
        
        return Response(ProviderAppointmentSerializer(appointment).data)
