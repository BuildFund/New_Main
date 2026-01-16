"""Views for Deal Progression module."""
from __future__ import annotations

from rest_framework import viewsets, permissions, status, serializers
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
from .provider_metrics_service import ProviderMetricsService
from consultants.models import ConsultantProfile


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
        DealService.update_completion_readiness(deal)
        deal.refresh_from_db()
        return Response({
            'score': deal.completion_readiness_score,
            'breakdown': deal.completion_readiness_breakdown,
        })
    
    @action(detail=True, methods=['get'], url_path='completion-readiness')
    def completion_readiness(self, request, pk=None):
        """Check if deal is ready to complete (includes provider deliverables check)."""
        deal = self.get_object()
        readiness_check = DealService.check_completion_readiness(deal)
        # Also update the score
        DealService.update_completion_readiness(deal)
        deal.refresh_from_db()
        return Response({
            **readiness_check,
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
            # Check if user has access to this deal - use deal_id (string) not id (integer)
            try:
                deal = Deal.objects.get(deal_id=deal_id)
                if self._user_has_deal_access(user, deal):
                    return DealParty.objects.filter(deal=deal).select_related('user', 'deal')
            except Deal.DoesNotExist:
                return DealParty.objects.none()
        
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
        """Filter threads based on user's deal access and thread visibility."""
        user = self.request.user
        deal_id_param = self.request.query_params.get('deal_id')
        
        qs = DealMessageThread.objects.select_related('deal', 'created_by').prefetch_related('visible_to_parties')
        
        if deal_id_param:
            # Look up Deal by deal_id (string) not id (integer)
            try:
                deal = Deal.objects.get(deal_id=deal_id_param)
                qs = qs.filter(deal=deal)
            except Deal.DoesNotExist:
                qs = qs.none()
        
        if not IsAdmin().has_permission(self.request, self):
            # Get deals user has access to
            deals = Deal.objects.filter(
                Q(lender__user=user) |
                Q(borrower_company__user=user) |
                Q(parties__user=user, parties__is_active=True)
            ).distinct()
            qs = qs.filter(deal__in=deals)
            
            # Filter by party visibility
            user_parties = DealParty.objects.filter(
                deal__in=deals
            ).filter(
                Q(user=user) |
                Q(lender_profile__user=user) |
                Q(borrower_profile__user=user) |
                Q(consultant_profile__user=user)
            ).distinct()
            
            # Only show threads where user's party is in visible_to_parties OR thread is not private
            qs = qs.filter(
                Q(visible_to_parties__in=user_parties) | Q(is_private=False)
            ).distinct()
        
        return qs
    
    def perform_create(self, serializer):
        """Create thread and set visibility based on thread type and creator."""
        thread = serializer.save(created_by=self.request.user)
        
        # Get user's party for this deal
        deal = thread.deal
        user_party = None
        if hasattr(self.request.user, 'lenderprofile') and deal.lender == self.request.user.lenderprofile:
            user_party = DealParty.objects.filter(deal=deal, lender_profile=deal.lender).first()
        elif hasattr(self.request.user, 'borrowerprofile') and deal.borrower_company == self.request.user.borrowerprofile:
            user_party = DealParty.objects.filter(deal=deal, borrower_profile=deal.borrower_company).first()
        elif hasattr(self.request.user, 'consultantprofile'):
            user_party = DealParty.objects.filter(
                deal=deal,
                consultant_profile=self.request.user.consultantprofile
            ).first()
        
        # Set visibility based on thread type
        if thread.thread_type == 'general':
            # General: Borrower + Lender
            borrower_party = DealParty.objects.filter(deal=deal, borrower_profile=deal.borrower_company).first()
            lender_party = DealParty.objects.filter(deal=deal, lender_profile=deal.lender).first()
            if borrower_party:
                thread.visible_to_parties.add(borrower_party)
            if lender_party:
                thread.visible_to_parties.add(lender_party)
            thread.visible_to_roles = ['borrower', 'lender']
        elif thread.thread_type == 'legal':
            # Legal: Lender + Lender Solicitor + Borrower Solicitor
            lender_party = DealParty.objects.filter(deal=deal, lender_profile=deal.lender).first()
            lender_solicitor = DealParty.objects.filter(deal=deal, party_type='solicitor', acting_for_party='lender').first()
            borrower_solicitor = DealParty.objects.filter(deal=deal, party_type='solicitor', acting_for_party='borrower').first()
            if lender_party:
                thread.visible_to_parties.add(lender_party)
            if lender_solicitor:
                thread.visible_to_parties.add(lender_solicitor)
            if borrower_solicitor:
                thread.visible_to_parties.add(borrower_solicitor)
            thread.visible_to_roles = ['lender', 'solicitor']
            thread.is_private = True
        elif thread.thread_type == 'valuation':
            # Valuation: Lender + Valuer
            lender_party = DealParty.objects.filter(deal=deal, lender_profile=deal.lender).first()
            valuer_party = DealParty.objects.filter(deal=deal, party_type='valuer').first()
            if lender_party:
                thread.visible_to_parties.add(lender_party)
            if valuer_party:
                thread.visible_to_parties.add(valuer_party)
            thread.visible_to_roles = ['lender', 'valuer']
            thread.is_private = True
        elif thread.thread_type == 'ims':
            # IMS: Lender + Monitoring Surveyor
            lender_party = DealParty.objects.filter(deal=deal, lender_profile=deal.lender).first()
            ms_party = DealParty.objects.filter(deal=deal, party_type='monitoring_surveyor').first()
            if lender_party:
                thread.visible_to_parties.add(lender_party)
            if ms_party:
                thread.visible_to_parties.add(ms_party)
            thread.visible_to_roles = ['lender', 'monitoring_surveyor']
            thread.is_private = True
        
        # Always add creator's party if not already added
        if user_party and user_party not in thread.visible_to_parties.all():
            thread.visible_to_parties.add(user_party)
        
        thread.save()


class DealMessageViewSet(viewsets.ModelViewSet):
    """ViewSet for Deal messages."""
    
    serializer_class = DealMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter messages based on thread access and user permissions."""
        user = self.request.user
        thread_id = self.request.query_params.get('thread_id')
        deal_id_param = self.request.query_params.get('deal_id')
        
        qs = DealMessage.objects.select_related('thread', 'thread__deal', 'sender', 'sender_user')
        
        if thread_id:
            qs = qs.filter(thread_id=thread_id)
        elif deal_id_param:
            try:
                deal = Deal.objects.get(deal_id=deal_id_param)
                qs = qs.filter(thread__deal=deal)
            except Deal.DoesNotExist:
                return DealMessage.objects.none()
        
        # Filter by thread visibility
        if not IsAdmin().has_permission(self.request, self):
            # Get user's parties
            user_parties = DealParty.objects.filter(
                Q(user=user) |
                Q(lender_profile__user=user) |
                Q(borrower_profile__user=user) |
                Q(consultant_profile__user=user)
            ).distinct()
            
            # Only show messages from threads user can access
            accessible_threads = DealMessageThread.objects.filter(
                Q(visible_to_parties__in=user_parties) | Q(is_private=False)
            ).distinct()
            
            qs = qs.filter(thread__in=accessible_threads)
        
        # Order by created_at ascending for WhatsApp-style display
        return qs.order_by('thread', 'created_at')
    
    def perform_create(self, serializer):
        """Set sender when creating message."""
        # Find the user's DealParty for this deal
        thread = serializer.validated_data['thread']
        deal = thread.deal
        
        # Find user's party
        user_party = None
        if hasattr(self.request.user, 'lenderprofile') and deal.lender == self.request.user.lenderprofile:
            user_party = DealParty.objects.filter(deal=deal, lender_profile=deal.lender).first()
        elif hasattr(self.request.user, 'borrowerprofile') and deal.borrower_company == self.request.user.borrowerprofile:
            user_party = DealParty.objects.filter(deal=deal, borrower_profile=deal.borrower_company).first()
        elif hasattr(self.request.user, 'consultantprofile'):
            user_party = DealParty.objects.filter(
                deal=deal,
                consultant_profile=self.request.user.consultantprofile
            ).first()
        
        if not user_party:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You are not a party to this deal")
        
        # Update thread's last_message_at
        thread.last_message_at = timezone.now()
        thread.save()
        
        serializer.save(sender=user_party, sender_user=self.request.user)


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
            enquiry.status = 'received'
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
        if enquiry.status in ['sent', 'received', 'viewed']:
            enquiry.status = 'acknowledged'
        enquiry.save()
        
        # TODO: Send notification to lender and borrower about acknowledgment
        # Using existing notification system
        
        return Response(ProviderEnquirySerializer(enquiry).data)
    
    @action(detail=True, methods=['post'], url_path='update-status')
    def update_status(self, request, pk=None):
        """Update enquiry status through the workflow (received, acknowledged, preparing_quote, queries_raised, ready_to_submit)."""
        enquiry = self.get_object()
        
        # Check permissions - only provider can update status
        if not hasattr(request.user, 'consultantprofile') or enquiry.provider_firm != request.user.consultantprofile:
            return Response(
                {'error': 'Only the provider can update enquiry status'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        new_status = request.data.get('status')
        notes = request.data.get('notes', '')
        
        # Valid status transitions
        valid_statuses = ['received', 'acknowledged', 'preparing_quote', 'queries_raised', 'ready_to_submit']
        if new_status not in valid_statuses:
            return Response(
                {'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate status transition
        current_status = enquiry.status
        valid_transitions = {
            'sent': ['received'],
            'received': ['acknowledged', 'preparing_quote'],
            'acknowledged': ['preparing_quote', 'queries_raised'],
            'preparing_quote': ['queries_raised', 'ready_to_submit'],
            'queries_raised': ['preparing_quote', 'ready_to_submit'],
            'ready_to_submit': [],  # Can only submit quote from here
        }
        
        if new_status not in valid_transitions.get(current_status, []):
            return Response(
                {'error': f'Cannot transition from {current_status} to {new_status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update status
        enquiry.status = new_status
        
        # Update timestamps and notes
        if new_status == 'received' and not enquiry.viewed_at:
            enquiry.viewed_at = timezone.now()
        elif new_status == 'acknowledged' and not enquiry.acknowledged_at:
            enquiry.acknowledged_at = timezone.now()
            if notes:
                enquiry.acknowledgment_notes = notes
        elif new_status == 'queries_raised' and notes:
            # Store queries in acknowledgment_notes or create a separate field
            if enquiry.acknowledgment_notes:
                enquiry.acknowledgment_notes += f"\n\nQueries raised: {notes}"
            else:
                enquiry.acknowledgment_notes = f"Queries raised: {notes}"
        
        enquiry.save()
        
        # TODO: Send notification to lender about status update
        # Using existing notification system
        
        return Response(ProviderEnquirySerializer(enquiry).data)
    
    @action(detail=True, methods=['post'], url_path='decline')
    def decline_enquiry(self, request, pk=None):
        """Decline the enquiry and provide a reason."""
        enquiry = self.get_object()
        
        # Check permissions - only provider can decline
        if not hasattr(request.user, 'consultantprofile') or enquiry.provider_firm != request.user.consultantprofile:
            return Response(
                {'error': 'Only the provider can decline an enquiry'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if enquiry can be declined (not already quoted or declined)
        if enquiry.status in ['quoted', 'declined', 'expired']:
            return Response(
                {'error': f'Cannot decline enquiry with status: {enquiry.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        decline_reason = request.data.get('reason', '').strip()
        if not decline_reason:
            return Response(
                {'error': 'Reason is required for declining an enquiry'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update enquiry status and reason
        enquiry.status = 'declined'
        enquiry.decline_reason = decline_reason
        enquiry.save()
        
        # TODO: Send notification to lender and borrower about decline
        # Using existing notification system
        
        return Response(ProviderEnquirySerializer(enquiry).data)
    
    @action(detail=True, methods=['post'], url_path='refresh-summary')
    def refresh_summary(self, request, pk=None):
        """Refresh the deal_summary_snapshot for an existing enquiry (useful if snapshot was empty or outdated)."""
        enquiry = self.get_object()
        
        # Check permissions - lender or admin can refresh
        if not hasattr(request.user, 'lenderprofile') or enquiry.deal.lender != request.user.lenderprofile:
            if not IsAdmin().has_permission(request, self):
                return Response(
                    {'error': 'Only the lender or admin can refresh the deal summary'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Rebuild the deal summary snapshot using the same logic as request_quotes
        deal = enquiry.deal
        project = deal.application.project if deal.application and deal.application.project else None
        borrower = deal.borrower_company
        lender = deal.lender
        product = deal.application.product if deal.application and deal.application.product else None
        application = deal.application if deal.application else None
        
        # Get commercial terms from deal or application
        commercial_terms = deal.commercial_terms if deal.commercial_terms else {}
        if application:
            if not commercial_terms.get('loan_amount'):
                commercial_terms['loan_amount'] = float(application.proposed_loan_amount) if application.proposed_loan_amount else None
            if not commercial_terms.get('term_months'):
                commercial_terms['term_months'] = application.proposed_term_months
            if not commercial_terms.get('ltv_ratio'):
                commercial_terms['ltv_ratio'] = float(application.proposed_ltv_ratio) if application.proposed_ltv_ratio else None
            if not commercial_terms.get('interest_rate'):
                commercial_terms['interest_rate'] = float(application.proposed_interest_rate) if application.proposed_interest_rate else None
        
        # Helper functions (same as in request_quotes)
        def get_loan_amount_range(amount):
            if not amount:
                return None
            try:
                amount_float = float(amount)
                if amount_float < 100000:
                    return '< £100k'
                elif amount_float < 500000:
                    return '£100k - £500k'
                elif amount_float < 1000000:
                    return '£500k - £1M'
                elif amount_float < 5000000:
                    return '£1M - £5M'
                else:
                    return '£5M+'
            except (ValueError, TypeError):
                return None
        
        def get_ltv_range(ltv):
            if not ltv:
                return None
            try:
                ltv_float = float(ltv)
                if ltv_float < 50:
                    return '< 50%'
                elif ltv_float < 65:
                    return '50-65%'
                elif ltv_float < 75:
                    return '65-75%'
                else:
                    return '75%+'
            except (ValueError, TypeError):
                return None
        
        def get_interest_rate_range(rate):
            if not rate:
                return None
            try:
                rate_float = float(rate)
                if rate_float < 5:
                    return '< 5%'
                elif rate_float < 8:
                    return '5-8%'
                elif rate_float < 12:
                    return '8-12%'
                else:
                    return '12%+'
            except (ValueError, TypeError):
                return None
        
        def get_borrower_experience_summary(borrower):
            if not borrower:
                return None
            summary = {}
            if hasattr(borrower, 'company_data') and borrower.company_data:
                incorporation_date = borrower.company_data.get('date_of_creation')
                if incorporation_date:
                    try:
                        from datetime import datetime
                        inc_date = datetime.fromisoformat(incorporation_date.replace('Z', '+00:00'))
                        years = (timezone.now() - inc_date).days / 365.25
                        if years < 2:
                            summary['experience_level'] = 'New/Start-up'
                        elif years < 5:
                            summary['experience_level'] = '2-5 years'
                        elif years < 10:
                            summary['experience_level'] = '5-10 years'
                        else:
                            summary['experience_level'] = '10+ years'
                    except (ValueError, TypeError, AttributeError):
                        pass
            if not summary.get('experience_level') and hasattr(borrower, 'experience_description') and borrower.experience_description:
                summary['has_experience_description'] = True
            return summary if summary else None
        
        # Build comprehensive deal summary (same structure as request_quotes)
        deal_summary = {
            'deal_id': deal.deal_id,
            'facility_type': deal.facility_type,
            'facility_type_display': deal.get_facility_type_display(),
            'jurisdiction': deal.jurisdiction,
            'deal_status': deal.status,
            'deal_status_display': deal.get_status_display() if hasattr(deal, 'get_status_display') else deal.status,
            
            'project': {
                'property_type': project.property_type if project else None,
                'property_type_display': project.get_property_type_display() if project and hasattr(project, 'get_property_type_display') else None,
                'description': project.description if project else None,
                'address': project.address if project else None,
                'town': project.town if project else None,
                'county': project.county if project else None,
                'postcode': project.postcode if project else None,
                'development_extent': project.development_extent if project else None,
                'development_extent_display': project.get_development_extent_display() if project and hasattr(project, 'get_development_extent_display') else None,
                'tenure': project.tenure if project else None,
                'tenure_display': project.get_tenure_display() if project and hasattr(project, 'get_tenure_display') else None,
                'planning_permission': project.planning_permission if project else None,
                'planning_authority': project.planning_authority if project else None,
                'planning_reference': project.planning_reference if project else None,
                'planning_description': project.planning_description if project else None,
                'unit_counts': project.unit_counts if project and hasattr(project, 'unit_counts') and project.unit_counts else {},
                'gross_internal_area': float(project.gross_internal_area) if project and project.gross_internal_area else None,
                'purchase_price': float(project.purchase_price) if project and project.purchase_price else None,
                'purchase_costs': float(project.purchase_costs) if project and project.purchase_costs else None,
                'build_cost': float(project.build_cost) if project and project.build_cost else None,
                'current_market_value': float(project.current_market_value) if project and project.current_market_value else None,
                'gross_development_value': float(project.gross_development_value) if project and project.gross_development_value else None,
                'repayment_method': project.repayment_method if project else None,
                'repayment_method_display': project.get_repayment_method_display() if project and hasattr(project, 'get_repayment_method_display') else None,
                'term_required_months': project.term_required_months if project else None,
                'funding_type': project.funding_type if project else None,
                'funding_type_display': project.get_funding_type_display() if project and hasattr(project, 'get_funding_type_display') else None,
            } if project else {},
            
            'borrower': {
                'company_name': borrower.company_name if borrower else None,
                'trading_name': borrower.trading_name if borrower else None,
                'company_type': borrower.company_data.get('company_type') if borrower and hasattr(borrower, 'company_data') and borrower.company_data else None,
                'company_type_display': borrower.company_data.get('company_type') if borrower and hasattr(borrower, 'company_data') and borrower.company_data else None,
                'experience_summary': get_borrower_experience_summary(borrower),
            } if borrower else {},
            
            'lender': {
                'organisation_name': lender.organisation_name if lender else None,
                'contact_email': lender.contact_email if lender else None,
                'contact_phone': lender.contact_phone if lender else None,
                'website': lender.website if lender else None,
                'description': lender.description[:500] if lender and hasattr(lender, 'description') and lender.description else None,
            } if lender else {},
            
            'product': {
                'name': product.name if product else None,
                'funding_type': product.funding_type if product else None,
                'funding_type_display': product.get_funding_type_display() if product and hasattr(product, 'get_funding_type_display') else None,
                'description': product.description[:1000] if product and product.description else None,
                'property_type': product.property_type if product else None,
                'property_type_display': product.get_property_type_display() if product and hasattr(product, 'get_property_type_display') else None,
                'repayment_structure': product.repayment_structure if product else None,
                'repayment_structure_display': product.get_repayment_structure_display() if product and hasattr(product, 'get_repayment_structure_display') else None,
                'min_loan_amount': float(product.min_loan_amount) if product and product.min_loan_amount else None,
                'max_loan_amount': float(product.max_loan_amount) if product and product.max_loan_amount else None,
                'interest_rate_min': float(product.interest_rate_min) if product and product.interest_rate_min else None,
                'interest_rate_max': float(product.interest_rate_max) if product and product.interest_rate_max else None,
                'term_min_months': product.term_min_months if product else None,
                'term_max_months': product.term_max_months if product else None,
                'max_ltv_ratio': float(product.max_ltv_ratio) if product and product.max_ltv_ratio else None,
                'eligibility_criteria': product.eligibility_criteria[:1000] if product and product.eligibility_criteria else None,
            } if product else {},
            
            'application_terms': {
                'proposed_loan_amount_range': get_loan_amount_range(commercial_terms.get('loan_amount')),
                'proposed_term_months': commercial_terms.get('term_months'),
                'proposed_ltv_range': get_ltv_range(commercial_terms.get('ltv_ratio')),
                'proposed_interest_rate_range': get_interest_rate_range(commercial_terms.get('interest_rate')),
            } if commercial_terms else {},
            
            'commercial_indicators': {
                'loan_amount_range': get_loan_amount_range(commercial_terms.get('loan_amount')),
                'term_months': commercial_terms.get('term_months'),
                'ltv_range': get_ltv_range(commercial_terms.get('ltv_ratio')),
                'interest_rate_range': get_interest_rate_range(commercial_terms.get('interest_rate')),
                'repayment_structure': commercial_terms.get('repayment_structure'),
            } if commercial_terms else {},
            
            'security_structure': {
                'primary_security': 'Property' if project else 'Not specified',
                'security_type': 'First charge' if deal.facility_type in ['development', 'term'] else 'Not specified',
            },
            
            'transaction_structure': {
                'borrower_entity_type': borrower.company_data.get('company_type') if borrower and hasattr(borrower, 'company_data') and borrower.company_data else None,
                'borrower_entity_type_display': borrower.company_data.get('company_type') if borrower and hasattr(borrower, 'company_data') and borrower.company_data else None,
                'deal_structure': deal.facility_type,
                'deal_structure_display': deal.get_facility_type_display(),
                'jurisdiction': deal.jurisdiction,
                'transaction_type': 'Development Finance' if deal.facility_type == 'development' else 'Term Loan' if deal.facility_type == 'term' else 'Bridge Finance',
                'security_type': 'First charge on property',
                'complexity_indicators': {
                    'has_multiple_securities': False,
                    'has_guarantees': False,
                    'has_intercreditor': deal.facility_type == 'development',
                    'requires_planning_condition_satisfaction': project.planning_permission if project else False,
                },
                'expected_completion_timeline': commercial_terms.get('term_months'),
            },
        }
        
        # Update enquiry with refreshed snapshot
        enquiry.deal_summary_snapshot = deal_summary
        enquiry.save()
        
        return Response({
            'message': 'Deal summary snapshot refreshed successfully',
            'enquiry': ProviderEnquirySerializer(enquiry).data,
        })
    
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
        
        def get_interest_rate_range(rate):
            """Convert exact interest rate to range for privacy."""
            if not rate:
                return None
            try:
                rate = float(rate)
                if rate < 5:
                    return '< 5%'
                elif rate < 8:
                    return '5% - 8%'
                elif rate < 12:
                    return '8% - 12%'
                else:
                    return '> 12%'
            except (ValueError, TypeError):
                return None
        
        def get_borrower_experience_summary(borrower):
            """Get anonymized borrower experience summary."""
            if not borrower:
                return None
            # Anonymized experience indicators
            summary = {}
            # Check if borrower has experience data in financial_data or company_data
            if hasattr(borrower, 'company_data') and borrower.company_data:
                # Extract company incorporation date if available
                incorporation_date = borrower.company_data.get('date_of_creation')
                if incorporation_date:
                    try:
                        from datetime import datetime
                        inc_date = datetime.fromisoformat(incorporation_date.replace('Z', '+00:00'))
                        years = (timezone.now() - inc_date).days / 365.25
                        if years < 2:
                            summary['experience_level'] = 'New/Start-up'
                        elif years < 5:
                            summary['experience_level'] = '2-5 years'
                        elif years < 10:
                            summary['experience_level'] = '5-10 years'
                        else:
                            summary['experience_level'] = '10+ years'
                    except (ValueError, TypeError, AttributeError):
                        pass
            # If no date available, check experience_description for indicators
            if not summary.get('experience_level') and hasattr(borrower, 'experience_description') and borrower.experience_description:
                summary['has_experience_description'] = True
            return summary if summary else None
        
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
        application = deal.application if deal.application else None
        
        # Get commercial terms from deal or application
        commercial_terms = deal.commercial_terms if deal.commercial_terms else {}
        if application:
            # Use application terms if deal terms not available
            if not commercial_terms.get('loan_amount'):
                commercial_terms['loan_amount'] = float(application.proposed_loan_amount) if application.proposed_loan_amount else None
            if not commercial_terms.get('term_months'):
                commercial_terms['term_months'] = application.proposed_term_months
            if not commercial_terms.get('ltv_ratio'):
                commercial_terms['ltv_ratio'] = float(application.proposed_ltv_ratio) if application.proposed_ltv_ratio else None
            if not commercial_terms.get('interest_rate'):
                commercial_terms['interest_rate'] = float(application.proposed_interest_rate) if application.proposed_interest_rate else None
        
        deal_summary = {
            'deal_id': deal.deal_id,
            'facility_type': deal.facility_type,
            'facility_type_display': deal.get_facility_type_display(),
            'jurisdiction': deal.jurisdiction,
            'deal_status': deal.status,
            'deal_status_display': deal.get_status_display() if hasattr(deal, 'get_status_display') else deal.status,
            
            # Project information (comprehensive but non-sensitive)
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
                'purchase_costs': float(project.purchase_costs) if project and project.purchase_costs else None,
                'build_cost': float(project.build_cost) if project and project.build_cost else None,
                'current_market_value': float(project.current_market_value) if project and project.current_market_value else None,
                'gross_development_value': float(project.gross_development_value) if project and project.gross_development_value else None,
                'repayment_method': project.repayment_method if project else None,
                'repayment_method_display': project.get_repayment_method_display() if project else None,
                'term_required_months': project.term_required_months if project else None,
                'funding_type': project.funding_type if project else None,
                'funding_type_display': project.get_funding_type_display() if project else None,
            } if project else {},
            
            # Borrower company information (non-sensitive - company info only, no personal data)
            'borrower': {
                'company_name': borrower.company_name if borrower else None,
                'trading_name': borrower.trading_name if borrower else None,
                'company_type': borrower.company_data.get('company_type') if borrower and hasattr(borrower, 'company_data') and borrower.company_data else None,
                'company_type_display': borrower.company_data.get('company_type') if borrower and hasattr(borrower, 'company_data') and borrower.company_data else None,
                'experience_summary': get_borrower_experience_summary(borrower),
            } if borrower else {},
            
            # Lender information (comprehensive public info)
            'lender': {
                'organisation_name': lender.organisation_name if lender else None,
                'contact_email': lender.contact_email if lender else None,
                'contact_phone': lender.contact_phone if lender else None,
                'website': lender.website if lender else None,
                'description': lender.description[:500] if lender and hasattr(lender, 'description') and lender.description else None,
            } if lender else {},
            
            # Product information (comprehensive product details)
            'product': {
                'name': product.name if product else None,
                'funding_type': product.funding_type if product else None,
                'funding_type_display': product.get_funding_type_display() if product else None,
                'description': product.description[:1000] if product and product.description else None,  # Longer description for consultants
                'property_type': product.property_type if product else None,
                'property_type_display': product.get_property_type_display() if product else None,
                'repayment_structure': product.repayment_structure if product else None,
                'repayment_structure_display': product.get_repayment_structure_display() if product else None,
                'min_loan_amount': float(product.min_loan_amount) if product and product.min_loan_amount else None,
                'max_loan_amount': float(product.max_loan_amount) if product and product.max_loan_amount else None,
                'interest_rate_min': float(product.interest_rate_min) if product and product.interest_rate_min else None,
                'interest_rate_max': float(product.interest_rate_max) if product and product.interest_rate_max else None,
                'term_min_months': product.term_min_months if product else None,
                'term_max_months': product.term_max_months if product else None,
                'max_ltv_ratio': float(product.max_ltv_ratio) if product and product.max_ltv_ratio else None,
                'eligibility_criteria': product.eligibility_criteria[:1000] if product and product.eligibility_criteria else None,
            } if product else {},
            
            # Application terms (proposed terms for this deal)
            'application_terms': {
                'proposed_loan_amount_range': get_loan_amount_range(commercial_terms.get('loan_amount')),
                'proposed_term_months': commercial_terms.get('term_months'),
                'proposed_ltv_range': get_ltv_range(commercial_terms.get('ltv_ratio')),
                'proposed_interest_rate_range': get_interest_rate_range(commercial_terms.get('interest_rate')),
            } if commercial_terms else {},
            
            # Deal commercial terms (ranges/indicators only, not exact amounts)
            'commercial_indicators': {
                'loan_amount_range': get_loan_amount_range(commercial_terms.get('loan_amount')),
                'term_months': commercial_terms.get('term_months'),
                'ltv_range': get_ltv_range(commercial_terms.get('ltv_ratio')),
                'interest_rate_range': get_interest_rate_range(commercial_terms.get('interest_rate')),
                'repayment_structure': commercial_terms.get('repayment_structure'),
            } if commercial_terms else {},
            
            # Security structure (non-sensitive - structure only, not exact details)
            'security_structure': {
                'primary_security': 'Property' if project else 'Not specified',
                'security_type': 'First charge' if deal.facility_type in ['development', 'term'] else 'Not specified',
            },
            
            # Transaction structure (for solicitors - comprehensive)
            'transaction_structure': {
                'borrower_entity_type': borrower.company_data.get('company_type') if borrower and hasattr(borrower, 'company_data') and borrower.company_data else None,
                'borrower_entity_type_display': borrower.company_data.get('company_type') if borrower and hasattr(borrower, 'company_data') and borrower.company_data else None,
                'deal_structure': deal.facility_type,
                'deal_structure_display': deal.get_facility_type_display(),
                'jurisdiction': deal.jurisdiction,
                'transaction_type': 'Development Finance' if deal.facility_type == 'development' else 'Term Loan' if deal.facility_type == 'term' else 'Bridge Finance',
                'security_type': 'First charge on property',
                'complexity_indicators': {
                    'has_multiple_securities': False,  # Can be enhanced based on deal data
                    'has_guarantees': False,  # Can be enhanced based on deal data
                    'has_intercreditor': deal.facility_type == 'development',  # Development finance often has intercreditor arrangements
                    'requires_planning_condition_satisfaction': project.planning_permission if project else False,
                },
                'expected_completion_timeline': commercial_terms.get('term_months'),  # Term in months
            },
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
        user = self.request.user
        enquiry_id = serializer.validated_data.get('enquiry')
        
        # Get the enquiry to check permissions
        try:
            enquiry = ProviderEnquiry.objects.select_related('provider_firm', 'deal').get(id=enquiry_id.id if hasattr(enquiry_id, 'id') else enquiry_id)
        except ProviderEnquiry.DoesNotExist:
            raise serializers.ValidationError({'enquiry': 'Enquiry not found'})
        
        # Check permissions - consultant can only create quotes for enquiries sent to their firm
        if hasattr(user, 'consultantprofile'):
            if enquiry.provider_firm != user.consultantprofile:
                raise permissions.PermissionDenied('You can only submit quotes for enquiries sent to your firm.')
        
        # Check if enquiry status allows quote submission
        if enquiry.status in ['declined', 'expired', 'quoted']:
            raise serializers.ValidationError(
                {'enquiry': f'Cannot submit quote for enquiry with status: {enquiry.get_status_display()}'}
            )
        
        # Save the quote
        quote = serializer.save(status='submitted')
        
        # Update enquiry status to 'quoted' if it's in a state that allows submission
        if enquiry.status in ['sent', 'viewed', 'received', 'acknowledged', 'preparing_quote', 'queries_raised', 'ready_to_submit']:
            enquiry.status = 'quoted'
            enquiry.save()
        
        # TODO: Send notification to lender and borrower
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Accept a quote (lender/borrower action)."""
        quote = self.get_object()
        notes = request.data.get('notes', '')
        
        # Check permissions - lender or borrower can accept
        user = request.user
        deal = quote.enquiry.deal
        is_lender = hasattr(user, 'lenderprofile') and deal.lender == user.lenderprofile
        is_borrower = hasattr(user, 'borrowerprofile') and deal.borrower_company == user.borrowerprofile
        
        if not (is_lender or is_borrower or IsAdmin().has_permission(request, self)):
            return Response(
                {'error': 'Only lender or borrower can accept quotes'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if quote.status != 'submitted' and quote.status != 'under_review':
            return Response(
                {'error': f'Cannot accept quote with status: {quote.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        quote.status = 'accepted'
        quote.accepted_at = timezone.now()
        quote.lender_notes = notes
        quote.save()
        
        # Create provider selection
        from .models import DealProviderSelection
        selection, created = DealProviderSelection.objects.get_or_create(
            deal=deal,
            role_type=quote.role_type,
            provider_firm=quote.enquiry.provider_firm,
            defaults={
                'selected_by': user,
                'quote': quote,
            }
        )
        if not created:
            selection.quote = quote
            selection.selected_by = user
            selection.selected_at = timezone.now()
            selection.save()
        
        # TODO: Send notification to provider
        
        return Response(ProviderQuoteSerializer(quote).data)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a quote (lender/borrower action)."""
        quote = self.get_object()
        reason = request.data.get('reason', '')
        
        if not reason:
            return Response(
                {'error': 'Reason for rejection is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check permissions - lender or borrower can reject
        user = request.user
        deal = quote.enquiry.deal
        is_lender = hasattr(user, 'lenderprofile') and deal.lender == user.lenderprofile
        is_borrower = hasattr(user, 'borrowerprofile') and deal.borrower_company == user.borrowerprofile
        
        if not (is_lender or is_borrower or IsAdmin().has_permission(request, self)):
            return Response(
                {'error': 'Only lender or borrower can reject quotes'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if quote.status in ['accepted', 'declined', 'withdrawn', 'expired']:
            return Response(
                {'error': f'Cannot reject quote with status: {quote.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        quote.status = 'declined'
        quote.lender_notes = reason
        quote.reviewed_at = timezone.now()
        quote.save()
        
        # TODO: Send notification to provider
        
        return Response(ProviderQuoteSerializer(quote).data)
    
    @action(detail=True, methods=['post'])
    def negotiate(self, request, pk=None):
        """Request negotiation on a quote (lender/borrower action)."""
        quote = self.get_object()
        negotiation_notes = request.data.get('notes', '')
        counter_price = request.data.get('counter_price')
        
        if not negotiation_notes:
            return Response(
                {'error': 'Negotiation notes are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check permissions - lender or borrower can negotiate
        user = request.user
        deal = quote.enquiry.deal
        is_lender = hasattr(user, 'lenderprofile') and deal.lender == user.lenderprofile
        is_borrower = hasattr(user, 'borrowerprofile') and deal.borrower_company == user.borrowerprofile
        
        if not (is_lender or is_borrower or IsAdmin().has_permission(request, self)):
            return Response(
                {'error': 'Only lender or borrower can negotiate quotes'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if quote.status in ['accepted', 'declined', 'withdrawn', 'expired']:
            return Response(
                {'error': f'Cannot negotiate quote with status: {quote.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        quote.status = 'under_review'
        quote.lender_notes = (quote.lender_notes or '') + f'\n[Negotiation Request] {negotiation_notes}'
        if counter_price:
            quote.lender_notes += f'\n[Counter Price] £{counter_price}'
        quote.reviewed_at = timezone.now()
        quote.save()
        
        # TODO: Send notification to provider
        
        return Response(ProviderQuoteSerializer(quote).data)


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
        
        # Create ProviderStageInstance with initial stage and tasks
        from .provider_workflow_templates import (
            get_initial_provider_stage,
            get_provider_stage_template
        )
        from .models import DealTask, DealStage
        
        initial_stage = get_initial_provider_stage(selection.role_type)
        stage_instance, created = ProviderStageInstance.objects.get_or_create(
            deal=selection.deal,
            role_type=selection.role_type,
            provider_firm=selection.provider_firm,
            defaults={
                'current_stage': initial_stage,
                'instructed_at': timezone.now(),
                'started_at': timezone.now(),
            }
        )
        
        # If newly created, initialize tasks for the initial stage
        if created:
            stage_template = get_provider_stage_template(selection.role_type, initial_stage)
            if stage_template:
                # Get or create a deal stage for provider tasks (or use a generic stage)
                # For now, we'll create tasks linked to the deal's current stage or first stage
                deal_stage = selection.deal.current_stage or selection.deal.stages.filter(stage_number=1).first()
                
                if deal_stage:
                    # Create tasks from template
                    for task_template in stage_template.get('tasks', []):
                        if task_template.get('optional', False):
                            continue  # Skip optional tasks for now
                        
                        # Find the provider's DealParty for assignment
                        provider_party = DealParty.objects.filter(
                            deal=selection.deal,
                            consultant_profile=selection.provider_firm,
                            party_type=selection.role_type
                        ).first()
                        
                        task = DealTask.objects.create(
                            deal=selection.deal,
                            stage=deal_stage,
                            title=task_template['title'],
                            description=task_template.get('description', ''),
                            owner_party_type=task_template.get('owner_party_type', selection.role_type),
                            assignee_party=provider_party,
                            priority=task_template.get('priority', 'medium'),
                            sla_hours=task_template.get('sla_hours'),
                            status='pending',
                        )
                        
                        # Set due date based on SLA if provided
                        if task.sla_hours:
                            from datetime import timedelta
                            task.due_date = timezone.now() + timedelta(hours=task.sla_hours)
                            task.save()
        
        # Update quote status if provided
        if selection.quote:
            selection.quote.status = 'accepted'
            selection.quote.accepted_at = timezone.now()
            selection.quote.save()
        
        # TODO: Send notifications


class ProviderStageInstanceViewSet(viewsets.ModelViewSet):
    """ViewSet for ProviderStageInstance."""
    
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
    
    @action(detail=True, methods=['post'])
    def advance_stage(self, request, pk=None):
        """Advance provider to next stage."""
        from .provider_workflow_templates import (
            get_next_provider_stage,
            get_provider_stage_template
        )
        from .models import DealTask, DealStage, DealParty
        from datetime import timedelta
        
        stage_instance = self.get_object()
        
        # Check permissions - only provider or lender can advance
        user = request.user
        if hasattr(user, 'consultantprofile') and stage_instance.provider_firm != user.consultantprofile:
            if not (hasattr(user, 'lenderprofile') and stage_instance.deal.lender == user.lenderprofile):
                if not IsAdmin().has_permission(request, self):
                    return Response(
                        {'error': 'Only the provider, lender, or admin can advance stages'},
                        status=status.HTTP_403_FORBIDDEN
                    )
        
        # Get next stage
        next_stage_name = get_next_provider_stage(stage_instance.role_type, stage_instance.current_stage)
        if not next_stage_name:
            return Response(
                {'error': 'No next stage available. Provider workflow is complete.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update stage history
        history = stage_instance.stage_history or []
        history.append({
            'stage': stage_instance.current_stage,
            'entered_at': stage_instance.stage_entered_at.isoformat() if stage_instance.stage_entered_at else None,
            'exited_at': timezone.now().isoformat(),
        })
        
        # Update current stage
        stage_instance.current_stage = next_stage_name
        stage_instance.stage_entered_at = timezone.now()
        stage_instance.stage_history = history
        
        # Mark as completed if final stage
        if next_stage_name in ['accepted', 'completed', 'completion']:
            stage_instance.completed_at = timezone.now()
        
        stage_instance.save()
        
        # Create tasks for new stage
        stage_template = get_provider_stage_template(stage_instance.role_type, next_stage_name)
        if stage_template:
            deal_stage = stage_instance.deal.current_stage or stage_instance.deal.stages.filter(stage_number=1).first()
            provider_party = DealParty.objects.filter(
                deal=stage_instance.deal,
                consultant_profile=stage_instance.provider_firm,
                party_type=stage_instance.role_type
            ).first()
            
            if deal_stage and provider_party:
                for task_template in stage_template.get('tasks', []):
                    if task_template.get('optional', False):
                        continue
                    
                    # Check if task already exists
                    existing = DealTask.objects.filter(
                        deal=stage_instance.deal,
                        stage=deal_stage,
                        title=task_template['title'],
                        assignee_party=provider_party
                    ).first()
                    
                    if existing:
                        continue
                    
                    task = DealTask.objects.create(
                        deal=stage_instance.deal,
                        stage=deal_stage,
                        title=task_template['title'],
                        description=task_template.get('description', ''),
                        owner_party_type=task_template.get('owner_party_type', stage_instance.role_type),
                        assignee_party=provider_party,
                        priority=task_template.get('priority', 'medium'),
                        sla_hours=task_template.get('sla_hours'),
                        status='pending',
                    )
                    
                    if task.sla_hours:
                        task.due_date = timezone.now() + timedelta(hours=task.sla_hours)
                        task.save()
        
        return Response(ProviderStageInstanceSerializer(stage_instance).data)


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
    
    def perform_create(self, serializer):
        """Create deliverable and handle document upload."""
        # Get uploaded file
        file = self.request.FILES.get('file')
        if not file:
            from rest_framework import serializers as drf_serializers
            raise drf_serializers.ValidationError({'file': 'File is required'})
        
        # Create document directly (simpler approach)
        document = Document.objects.create(
            owner=self.request.user,
            file_name=file.name,
            file_size=file.size,
            file_type=file.content_type or 'application/octet-stream',
            upload_path=f"deliverables/{self.request.user.id}/{file.name}",
        )
        
        # Get deliverable data
        deliverable_data = serializer.validated_data
        deal = deliverable_data['deal']
        role_type = deliverable_data['role_type']
        provider_firm = deliverable_data['provider_firm']
        deliverable_type = deliverable_data['deliverable_type']
        
        # Check if this is a revision (rejection or request for revision)
        existing_deliverable = ProviderDeliverable.objects.filter(
            deal=deal,
            role_type=role_type,
            provider_firm=provider_firm,
            deliverable_type=deliverable_type
        ).order_by('-version').first()
        
        if existing_deliverable:
            # This is a new version
            version = existing_deliverable.version + 1
            parent = existing_deliverable
            
            # Update version history
            history = existing_deliverable.version_history or []
            history.append({
                'version': existing_deliverable.version,
                'document_id': existing_deliverable.document.id if existing_deliverable.document else None,
                'uploaded_at': existing_deliverable.uploaded_at.isoformat(),
                'uploaded_by': existing_deliverable.uploaded_by.id if existing_deliverable.uploaded_by else None,
                'status': existing_deliverable.status,
                'review_notes': existing_deliverable.review_notes,
            })
        else:
            # First version
            version = 1
            parent = None
            history = []
        
        # Create deliverable
        deliverable = serializer.save(
            document=document,
            version=version,
            parent_deliverable=parent,
            version_history=history,
            uploaded_by=self.request.user,
            status='uploaded'
        )
        
        # If this is a revision, mark previous version as 'revised'
        if existing_deliverable and existing_deliverable.status in ['rejected', 'under_review']:
            existing_deliverable.status = 'revised'
            existing_deliverable.save()
    
    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        """Review a deliverable (approve/reject/request_revision)."""
        deliverable = self.get_object()
        action = request.data.get('action')  # 'approve', 'reject', or 'request_revision'
        review_notes = request.data.get('review_notes', '')
        
        if action not in ['approve', 'reject', 'request_revision']:
            return Response(
                {'error': 'action must be "approve", "reject", or "request_revision"'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check permissions - only lender can review
        if not hasattr(request.user, 'lenderprofile') or deliverable.deal.lender != request.user.lenderprofile:
            if not IsAdmin().has_permission(request, self):
                return Response(
                    {'error': 'Only the lender can review deliverables'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Update status based on action
        if action == 'approve':
            deliverable.status = 'approved'
        elif action == 'reject':
            deliverable.status = 'rejected'
        elif action == 'request_revision':
            deliverable.status = 'under_review'  # Keep under review, provider can upload new version
        
        deliverable.reviewed_by = request.user
        deliverable.reviewed_at = timezone.now()
        deliverable.review_notes = review_notes
        deliverable.save()
        
        # Update version history with review
        history = deliverable.version_history or []
        if history:
            # Update the last entry with review info
            history[-1]['reviewed_at'] = deliverable.reviewed_at.isoformat()
            history[-1]['reviewed_by'] = request.user.id
            history[-1]['review_notes'] = review_notes
            history[-1]['status'] = deliverable.status
            deliverable.version_history = history
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
    
    def perform_create(self, serializer):
        """Create appointment and set proposed_by."""
        appointment = serializer.save(proposed_by=self.request.user)
        
        # If date_time is provided directly (not via proposed_slots), set status to confirmed
        if appointment.date_time and not appointment.proposed_slots:
            appointment.status = 'confirmed'
            appointment.confirmed_by = self.request.user
            appointment.confirmed_at = timezone.now()
            appointment.save()
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm an appointment."""
        appointment = self.get_object()
        selected_slot = request.data.get('selected_slot')  # Index or date_time
        location = request.data.get('location', '')
        notes = request.data.get('notes', '')
        
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
                from datetime import datetime
                if isinstance(slot.get('date_time'), str):
                    appointment.date_time = datetime.fromisoformat(slot.get('date_time').replace('Z', '+00:00'))
                else:
                    appointment.date_time = slot.get('date_time')
                if slot.get('notes'):
                    appointment.notes = slot.get('notes') + '\n' + (appointment.notes or '')
        elif selected_slot:
            # Direct date_time provided
            from datetime import datetime
            if isinstance(selected_slot, str):
                appointment.date_time = datetime.fromisoformat(selected_slot.replace('Z', '+00:00'))
            else:
                appointment.date_time = selected_slot
        
        if location:
            appointment.location = location
        if notes:
            appointment.notes = (appointment.notes or '') + '\n' + notes
        
        appointment.status = 'confirmed'
        appointment.confirmed_by = request.user
        appointment.confirmed_at = timezone.now()
        appointment.save()
        
        # TODO: Send notification to provider
        
        return Response(ProviderAppointmentSerializer(appointment, context={'request': request}).data)
    
    @action(detail=True, methods=['post'])
    def reschedule(self, request, pk=None):
        """Reschedule an appointment."""
        appointment = self.get_object()
        new_date_time = request.data.get('date_time')
        location = request.data.get('location', '')
        notes = request.data.get('notes', '')
        
        # Check permissions - borrower, lender, or provider can reschedule
        is_borrower = hasattr(request.user, 'borrowerprofile') and appointment.deal.borrower_company == request.user.borrowerprofile
        is_lender = hasattr(request.user, 'lenderprofile') and appointment.deal.lender == request.user.lenderprofile
        is_provider = hasattr(request.user, 'consultantprofile') and appointment.provider_firm == request.user.consultantprofile
        
        if not (is_borrower or is_lender or is_provider):
            return Response(
                {'error': 'Only borrower, lender, or provider can reschedule appointments'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if not new_date_time:
            return Response(
                {'error': 'date_time is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from datetime import datetime
        if isinstance(new_date_time, str):
            appointment.date_time = datetime.fromisoformat(new_date_time.replace('Z', '+00:00'))
        else:
            appointment.date_time = new_date_time
        
        if location:
            appointment.location = location
        if notes:
            appointment.notes = (appointment.notes or '') + '\n[Rescheduled] ' + notes
        
        appointment.status = 'rescheduled'
        appointment.save()
        
        # TODO: Send notification to all parties
        
        return Response(ProviderAppointmentSerializer(appointment, context={'request': request}).data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel an appointment."""
        appointment = self.get_object()
        reason = request.data.get('reason', '')
        
        # Check permissions - borrower, lender, or provider can cancel
        is_borrower = hasattr(request.user, 'borrowerprofile') and appointment.deal.borrower_company == request.user.borrowerprofile
        is_lender = hasattr(request.user, 'lenderprofile') and appointment.deal.lender == request.user.lenderprofile
        is_provider = hasattr(request.user, 'consultantprofile') and appointment.provider_firm == request.user.consultantprofile
        
        if not (is_borrower or is_lender or is_provider):
            return Response(
                {'error': 'Only borrower, lender, or provider can cancel appointments'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        appointment.status = 'cancelled'
        if reason:
            appointment.notes = (appointment.notes or '') + '\n[Cancelled] ' + reason
        appointment.save()
        
        # TODO: Send notification to all parties
        
        return Response(ProviderAppointmentSerializer(appointment, context={'request': request}).data)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark appointment as completed."""
        appointment = self.get_object()
        notes = request.data.get('notes', '')
        
        # Check permissions - provider can mark as completed
        is_provider = hasattr(request.user, 'consultantprofile') and appointment.provider_firm == request.user.consultantprofile
        is_lender = hasattr(request.user, 'lenderprofile') and appointment.deal.lender == request.user.lenderprofile
        
        if not (is_provider or is_lender):
            return Response(
                {'error': 'Only provider or lender can mark appointments as completed'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        appointment.status = 'completed'
        if notes:
            appointment.notes = (appointment.notes or '') + '\n[Completed] ' + notes
        appointment.save()
        
        # TODO: Send notification to borrower
        
        return Response(ProviderAppointmentSerializer(appointment, context={'request': request}).data)


class ProviderMetricsViewSet(viewsets.ViewSet):
    """ViewSet for provider performance metrics and SLA reporting."""
    
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['get'], url_path='deal/(?P<deal_id>[^/.]+)')
    def deal_metrics(self, request, deal_id=None):
        """Get provider metrics for a specific deal."""
        from .models import Deal
        
        try:
            deal = Deal.objects.get(deal_id=deal_id)
        except Deal.DoesNotExist:
            return Response({'error': 'Deal not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check permissions - lender or admin only
        user = request.user
        is_lender = hasattr(user, 'lenderprofile') and deal.lender == user.lenderprofile
        is_admin = user.is_staff
        
        if not (is_lender or is_admin):
            return Response(
                {'error': 'Only lender or admin can view provider metrics'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get all providers for this deal
        selections = DealProviderSelection.objects.filter(deal=deal).select_related('provider_firm')
        
        metrics_by_provider = {}
        for selection in selections:
            metrics = ProviderMetricsService.calculate_provider_metrics_for_deal(
                deal_id=deal.deal_id,
                provider_firm=selection.provider_firm,
                role_type=selection.role_type
            )
            key = f"{selection.provider_firm.id}_{selection.role_type}"
            metrics_by_provider[key] = {
                'provider_firm': {
                    'id': selection.provider_firm.id,
                    'name': selection.provider_firm.organisation_name,
                },
                'role_type': selection.role_type,
                'role_type_display': selection.get_role_type_display(),
                **metrics
            }
        
        return Response({
            'deal_id': deal.deal_id,
            'metrics_by_provider': metrics_by_provider
        })
    
    @action(detail=False, methods=['get'], url_path='provider/(?P<provider_id>[^/.]+)')
    def provider_metrics(self, request, provider_id=None):
        """Get aggregated provider metrics for a provider firm."""
        try:
            provider_firm = ConsultantProfile.objects.get(id=provider_id)
        except ConsultantProfile.DoesNotExist:
            return Response({'error': 'Provider not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check permissions - lender, admin, or the provider themselves
        user = request.user
        is_provider = hasattr(user, 'consultantprofile') and user.consultantprofile == provider_firm
        is_admin = user.is_staff
        
        # Lender can see metrics for providers on their deals
        is_lender = hasattr(user, 'lenderprofile')
        if is_lender:
            # Check if provider has been selected on any of lender's deals
            lender_deals = Deal.objects.filter(lender=user.lenderprofile)
            has_selection = DealProviderSelection.objects.filter(
                deal__in=lender_deals,
                provider_firm=provider_firm
            ).exists()
            is_lender = has_selection
        
        if not (is_provider or is_admin or is_lender):
            return Response(
                {'error': 'You do not have permission to view these metrics'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get query parameters
        role_type = request.query_params.get('role_type')
        period_days = int(request.query_params.get('period_days', 90))
        
        period_start = timezone.now() - timezone.timedelta(days=period_days)
        period_end = timezone.now()
        
        # Calculate metrics
        metrics = {}
        
        # Quote response time
        quote_response = ProviderMetricsService.calculate_quote_response_time(
            provider_firm, role_type, period_start, period_end
        )
        metrics['quote_response_time'] = quote_response
        
        # Quote acceptance rate
        acceptance = ProviderMetricsService.calculate_quote_acceptance_rate(
            provider_firm, role_type, period_start, period_end
        )
        metrics['quote_acceptance_rate'] = acceptance
        
        # Deliverable delivery time
        delivery = ProviderMetricsService.calculate_deliverable_delivery_time(
            provider_firm, role_type, None, period_start, period_end
        )
        metrics['deliverable_delivery_time'] = delivery
        
        # Deliverable rework count
        rework = ProviderMetricsService.calculate_deliverable_rework_count(
            provider_firm, role_type, period_start, period_end
        )
        metrics['deliverable_rework_count'] = rework
        
        # Appointment lead time
        appointment_lead = ProviderMetricsService.calculate_appointment_lead_time(
            provider_firm, role_type, period_start, period_end
        )
        metrics['appointment_lead_time'] = appointment_lead
        
        return Response({
            'provider_firm': {
                'id': provider_firm.id,
                'name': provider_firm.organisation_name,
            },
            'role_type': role_type,
            'period_start': period_start,
            'period_end': period_end,
            'metrics': metrics
        })
