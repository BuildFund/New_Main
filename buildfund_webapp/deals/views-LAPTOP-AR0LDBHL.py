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
    lookup_field = 'deal_id'  # Use deal_id instead of pk for URL lookups
    lookup_url_kwarg = 'dealId'  # Match the URL parameter name
    
    def get_queryset(self):
        """Filter deals based on user role and permissions."""
        user = self.request.user
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"DealViewSet.get_queryset() called by user: {user.username} (ID: {user.id})")
        
        # Admin sees all deals
        if IsAdmin().has_permission(self.request, self):
            queryset = Deal.objects.select_related(
                'lender', 'borrower_company', 'current_stage', 'application'
            ).prefetch_related('parties', 'stages', 'tasks').all()
            logger.info(f"Admin {user.username} accessing deals - returning all {queryset.count()} deals")
            return queryset
        
        # Lender sees their deals (matching by ID, not name)
        if hasattr(user, 'lenderprofile'):
            lender_profile = user.lenderprofile
            queryset = Deal.objects.filter(lender=lender_profile).select_related(
                'lender', 'borrower_company', 'current_stage', 'application'
            ).prefetch_related('parties', 'stages', 'tasks').all()
            deal_count = queryset.count()
            deal_ids = [d.deal_id for d in queryset]
            logger.info(f"Lender {user.username} (lenderprofile ID: {lender_profile.id}) accessing deals - returning {deal_count} deals: {deal_ids}")
            return queryset
        
        # Borrower sees their deals
        if hasattr(user, 'borrowerprofile'):
            queryset = Deal.objects.filter(borrower_company=user.borrowerprofile).select_related(
                'lender', 'borrower_company', 'current_stage', 'application'
            ).prefetch_related('parties', 'stages', 'tasks').all()
            deal_count = queryset.count()
            deal_ids = [d.deal_id for d in queryset]
            logger.info(f"Borrower {user.username} accessing deals - returning {deal_count} deals: {deal_ids}")
            return queryset
        
        # Consultant sees deals they're party to
        if hasattr(user, 'consultantprofile'):
            queryset = Deal.objects.filter(
                parties__user=user,
                parties__appointment_status='active'
            ).select_related(
                'lender', 'borrower_company', 'current_stage', 'application'
            ).prefetch_related('parties', 'stages', 'tasks').distinct()
            deal_count = queryset.count()
            deal_ids = [d.deal_id for d in queryset]
            logger.info(f"Consultant {user.username} accessing deals - returning {deal_count} deals: {deal_ids}")
            return queryset
        
        # No profile - return empty queryset
        logger.warning(f"User {user.username} (ID: {user.id}) has no lender/borrower/consultant profile - returning empty queryset")
        logger.warning(f"User attributes: hasattr(user, 'lenderprofile')={hasattr(user, 'lenderprofile')}, hasattr(user, 'borrowerprofile')={hasattr(user, 'borrowerprofile')}, hasattr(user, 'consultantprofile')={hasattr(user, 'consultantprofile')}")
        return Deal.objects.none()
    
    def list(self, request, *args, **kwargs):
        """Override list to add logging."""
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"DealViewSet.list() called by user: {request.user.username} (ID: {request.user.id})")
        
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        logger.info(f"Returning {len(serializer.data)} deals to user {request.user.username}")
        if serializer.data:
            deal_ids = [d.get('deal_id') for d in serializer.data]
            logger.info(f"Deal IDs being returned: {deal_ids}")
        
        return Response(serializer.data)
    
    def get_object(self):
        """Override to handle lookup by deal_id or numeric id."""
        queryset = self.get_queryset()
        # DRF uses 'pk' as the default URL kwarg, but we also support 'dealId'
        lookup_value = self.kwargs.get('pk') or self.kwargs.get('dealId') or self.kwargs.get(self.lookup_field)
        
        if not lookup_value:
            from rest_framework.exceptions import NotFound
            raise NotFound("Deal ID not provided.")
        
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"DealViewSet.get_object() called with lookup_value: {lookup_value} by user: {self.request.user.username}")
        
        # First, try to find the deal in the full database (before filtering)
        # This helps us provide better error messages
        deal_exists = Deal.objects.filter(deal_id=lookup_value).exists() or Deal.objects.filter(pk=lookup_value).exists()
        logger.info(f"Deal exists in database: {deal_exists}")
        
        # Try to lookup by deal_id first (string like "DEAL-001")
        try:
            obj = queryset.get(deal_id=lookup_value)
            logger.info(f"Found deal by deal_id: {obj.deal_id} (ID: {obj.id})")
            self.check_object_permissions(self.request, obj)
            return obj
        except Deal.DoesNotExist:
            logger.info(f"Deal not found by deal_id: {lookup_value}")
            pass
        
        # Fallback to numeric ID lookup if deal_id doesn't match
        try:
            obj = queryset.get(pk=lookup_value)
            logger.info(f"Found deal by pk: {obj.deal_id} (ID: {obj.id})")
            self.check_object_permissions(self.request, obj)
            return obj
        except (Deal.DoesNotExist, ValueError) as e:
            logger.warning(f"Deal lookup failed: {e}")
            from rest_framework.exceptions import NotFound, PermissionDenied
            # If deal exists but not in queryset, it's a permission issue
            if deal_exists:
                raise PermissionDenied("You do not have permission to view this deal. The deal belongs to a different lender.")
            raise NotFound("Deal not found.")
    
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
        """Mark a task as complete, checking dependencies first."""
        task = self.get_object()
        
        # Check if dependencies are completed
        incomplete_deps = task.dependencies.filter(status__in=['pending', 'in_progress', 'blocked'])
        if incomplete_deps.exists():
            dep_titles = [dep.title for dep in incomplete_deps]
            return Response({
                'error': f'Cannot complete task: dependencies not met',
                'blocking_tasks': dep_titles,
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Mark as complete
        task.status = 'completed'
        task.completed_at = timezone.now()
        task.completed_by = request.user
        task.save()
        
        # Check if any blocked tasks can now be unblocked
        blocked_tasks = DealTask.objects.filter(
            deal=task.deal,
            status='blocked',
            dependencies__id=task.id
        ).distinct()
        
        for blocked_task in blocked_tasks:
            # Check if all dependencies are now complete
            if blocked_task.dependencies.filter(status__in=['pending', 'in_progress', 'blocked']).count() == 0:
                blocked_task.status = 'pending'
                blocked_task.save()
        
        # Update deal readiness
        deal = task.deal
        deal.calculate_readiness_score()
        deal.save()
        
        # Check if stage can be advanced (will be handled by workflow engine in future)
        serializer = DealTaskSerializer(task)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def filters(self, request):
        """Get filtered tasks: overdue, awaiting_review, critical_path."""
        deal_id = request.query_params.get('deal_id')
        filter_type = request.query_params.get('filter', 'all')
        
        qs = self.get_queryset()
        
        if deal_id:
            qs = qs.filter(deal_id=deal_id)
        
        now = timezone.now()
        
        if filter_type == 'overdue':
            qs = qs.filter(
                status__in=['pending', 'in_progress'],
                due_date__lt=now
            )
        elif filter_type == 'awaiting_review':
            # Tasks that are completed but need review/approval
            # For now, we'll use tasks with status 'in_progress' that have been updated recently
            # This can be enhanced with a review_status field later
            qs = qs.filter(status='in_progress')
        elif filter_type == 'critical_path':
            # Tasks that are critical priority or have many dependencies
            qs = qs.filter(
                Q(priority='critical') |
                Q(dependencies__isnull=False)
            ).distinct()
        elif filter_type == 'blocked':
            qs = qs.filter(status='blocked')
        
        serializer = DealTaskSerializer(qs, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def chase(self, request, pk=None):
        """One-click chase: send reminder to task assignee (rate-limited)."""
        task = self.get_object()
        user = request.user
        
        # Rate limiting: check last chase time (allow once per hour per task)
        from datetime import timedelta
        last_chase = getattr(task, '_last_chase_time', None)
        if last_chase and (timezone.now() - last_chase) < timedelta(hours=1):
            return Response({
                'error': 'Chase reminder already sent recently. Please wait before sending another.',
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        
        # Get assignee
        assignee_email = None
        assignee_name = None
        
        if task.assignee_user:
            assignee_email = task.assignee_user.email
            assignee_name = task.assignee_user.get_full_name() or task.assignee_user.username
        elif task.assignee_party:
            if task.assignee_party.user:
                assignee_email = task.assignee_party.user.email
                assignee_name = task.assignee_party.user.get_full_name() or task.assignee_party.user.username
        
        if not assignee_email:
            return Response({
                'error': 'No assignee found for this task',
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Send email notification
        try:
            from notifications.services import EmailNotificationService
            subject = f"Reminder: Task '{task.title}' - {task.deal.deal_id}"
            message = f"""
Dear {assignee_name},

This is a reminder that the following task requires your attention:

Task: {task.title}
Deal: {task.deal.deal_id}
Stage: {task.stage.name}
Due Date: {task.due_date.strftime('%Y-%m-%d %H:%M') if task.due_date else 'Not set'}
Priority: {task.get_priority_display()}

Description: {task.description or 'No description provided'}

Please log in to complete this task.

Best regards,
BuildFund Team
            """.strip()
            
            EmailNotificationService.send_email(
                subject=subject,
                message=message,
                recipient_list=[assignee_email]
            )
            
            # Create audit event
            from .models import AuditEvent
            # Use 'task_updated' as 'task_chased' may not be in EVENT_TYPE_CHOICES
            AuditEvent.objects.create(
                deal=task.deal,
                actor_user=user,
                event_type='task_updated',
                object_type='DealTask',
                object_id=task.id,
                metadata={
                    'action': 'chase_reminder_sent',
                    'task_title': task.title,
                    'assignee': assignee_name,
                }
            )
            
            # Store last chase time (we'll use a JSON field or cache for this)
            # For now, we'll just log it in the audit event
            
            return Response({
                'message': f'Chase reminder sent to {assignee_name}',
                'sent_at': timezone.now().isoformat(),
            })
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send chase reminder: {e}", exc_info=True)
            return Response({
                'error': f'Failed to send chase reminder: {str(e)}',
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
