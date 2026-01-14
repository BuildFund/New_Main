"""Views for Deal Progression module."""
from __future__ import annotations

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Prefetch
from django.utils import timezone

from accounts.permissions import IsAdmin, IsLender
from .models import (
    Deal, DealParty, DealStage, DealTask, DealCP, DealRequisition,
    Drawdown, DealMessageThread, DealMessage, DealDocumentLink,
    DealDecision, AuditEvent, LawFirm, LawFirmPanelMembership
)
from .serializers import (
    DealSerializer, DealPartySerializer, DealStageSerializer,
    DealTaskSerializer, DealCPSerializer, DealRequisitionSerializer,
    DrawdownSerializer, DealMessageThreadSerializer, DealMessageSerializer,
    DealDocumentLinkSerializer, DealDecisionSerializer, AuditEventSerializer,
    LawFirmSerializer, LawFirmPanelMembershipSerializer
)
from .services import DealService, WorkflowEngine


class DealViewSet(viewsets.ModelViewSet):
    """ViewSet for Deal CRUD operations."""
    
    serializer_class = DealSerializer
    permission_classes = [permissions.IsAuthenticated]
    
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
        
        # Consultant sees deals they're party to
        if hasattr(user, 'consultantprofile'):
            return Deal.objects.filter(
                parties__user=user,
                parties__is_active=True
            ).select_related(
                'lender', 'borrower_company', 'current_stage', 'application'
            ).prefetch_related('parties', 'stages', 'tasks').distinct()
        
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
    
    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        """Get deal timeline with all events."""
        deal = self.get_object()
        stages = DealStage.objects.filter(deal=deal).order_by('sequence_order')
        tasks = DealTask.objects.filter(deal=deal).order_by('created_at')
        decisions = DealDecision.objects.filter(deal=deal).order_by('made_at')
        audit_events = AuditEvent.objects.filter(deal=deal).order_by('timestamp')
        
        return Response({
            'stages': DealStageSerializer(stages, many=True).data,
            'tasks': DealTaskSerializer(tasks, many=True).data,
            'decisions': DealDecisionSerializer(decisions, many=True).data,
            'audit_events': AuditEventSerializer(audit_events, many=True).data,
        })


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
    
    @action(detail=True, methods=['post'])
    def invite(self, request, pk=None):
        """Invite a user to join a deal party."""
        deal_party = self.get_object()
        # Invitation logic handled by service
        return Response({'message': 'Invitation sent'})
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm party invitation and set role details."""
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
        
        deal_party.acting_for_party = acting_for
        deal_party.firm_name = firm_name
        deal_party.sra_number = sra_number
        deal_party.rics_number = rics_number
        deal_party.confirmed_at = timezone.now()
        deal_party.is_active = True
        deal_party.save()
        
        return Response(DealPartySerializer(deal_party).data)


class DealTaskViewSet(viewsets.ModelViewSet):
    """ViewSet for DealTask management."""
    
    serializer_class = DealTaskSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter tasks based on user's deal access."""
        user = self.request.user
        deal_id = self.request.query_params.get('deal_id')
        stage_id = self.request.query_params.get('stage_id')
        
        qs = DealTask.objects.select_related('deal', 'stage', 'assignee_user')
        
        if deal_id:
            qs = qs.filter(deal_id=deal_id)
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
        deal_id = self.request.query_params.get('deal_id')
        
        qs = DealCP.objects.select_related('deal', 'approved_by')
        
        if deal_id:
            qs = qs.filter(deal_id=deal_id)
        
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
        cp.status = 'not_satisfied'
        cp.rejected_reason = request.data.get('reason', '')
        cp.save()
        
        return Response(DealCPSerializer(cp).data)


class DealRequisitionViewSet(viewsets.ModelViewSet):
    """ViewSet for Legal Requisitions."""
    
    serializer_class = DealRequisitionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter requisitions based on user's deal access."""
        user = self.request.user
        deal_id = self.request.query_params.get('deal_id')
        
        qs = DealRequisition.objects.select_related('deal', 'raised_by', 'responded_by')
        
        if deal_id:
            qs = qs.filter(deal_id=deal_id)
        
        if not IsAdmin().has_permission(self.request, self):
            deals = Deal.objects.filter(
                Q(lender__user=user) |
                Q(borrower_company__user=user) |
                Q(parties__user=user, parties__is_active=True)
            ).distinct()
            qs = qs.filter(deal__in=deals)
        
        return qs.order_by('-raised_at')
    
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
        deal_id = self.request.query_params.get('deal_id')
        
        qs = Drawdown.objects.select_related('deal', 'approved_by')
        
        if deal_id:
            qs = qs.filter(deal_id=deal_id)
        
        if not IsAdmin().has_permission(self.request, self):
            deals = Deal.objects.filter(
                Q(lender__user=user) |
                Q(borrower_company__user=user) |
                Q(parties__user=user, parties__is_active=True)
            ).distinct()
            qs = qs.filter(deal__in=deals)
        
        return qs.order_by('sequence_number')
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a drawdown request."""
        drawdown = self.get_object()
        
        # Only lender can approve
        if not hasattr(request.user, 'lenderprofile') or drawdown.deal.lender != request.user.lenderprofile:
            if not IsAdmin().has_permission(self.request, self):
                return Response(
                    {'error': 'Only lender can approve drawdowns'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        drawdown.lender_approval_status = 'approved'
        drawdown.approved_by = request.user
        drawdown.approved_at = timezone.now()
        drawdown.status = 'approved'
        drawdown.save()
        
        return Response(DrawdownSerializer(drawdown).data)


class DealMessageThreadViewSet(viewsets.ModelViewSet):
    """ViewSet for Deal message threads."""
    
    serializer_class = DealMessageThreadSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter threads based on user's deal access."""
        user = self.request.user
        deal_id = self.request.query_params.get('deal_id')
        
        qs = DealMessageThread.objects.select_related('deal', 'created_by')
        
        if deal_id:
            qs = qs.filter(deal_id=deal_id)
        
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
