"""Admin views for borrower profile review."""
from __future__ import annotations

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from .models import BorrowerProfile, BorrowerProfileReview
from .serializers import BorrowerProfileSerializer


class BorrowerProfileReviewViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for admin to review borrower profiles."""
    
    serializer_class = BorrowerProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Only admins can access this."""
        user = self.request.user
        if not user.is_superuser:
            return BorrowerProfile.objects.none()
        
        status_filter = self.request.query_params.get('status')
        queryset = BorrowerProfile.objects.all().select_related('user', 'review')
        
        if status_filter:
            queryset = queryset.filter(wizard_status=status_filter)
        
        return queryset.order_by('-updated_at')
    
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve borrower profile."""
        profile = self.get_object()
        
        if not request.user.is_superuser:
            return Response(
                {'error': 'Only admins can approve profiles'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        review, _ = BorrowerProfileReview.objects.get_or_create(borrower=profile)
        review.status = 'approved'
        review.reviewed_by = request.user
        review.reviewed_at = timezone.now()
        review.save()
        
        profile.wizard_status = 'approved'
        profile.save()
        
        return Response({
            'success': True,
            'message': 'Borrower profile approved',
        })
    
    @action(detail=True, methods=["post"])
    def request_changes(self, request, pk=None):
        """Request changes to borrower profile."""
        profile = self.get_object()
        
        if not request.user.is_superuser:
            return Response(
                {'error': 'Only admins can request changes'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        change_requests = request.data.get('change_requests', [])
        internal_notes = request.data.get('internal_notes', '')
        
        review, _ = BorrowerProfileReview.objects.get_or_create(borrower=profile)
        review.status = 'changes_requested'
        review.reviewed_by = request.user
        review.reviewed_at = timezone.now()
        review.change_requests = change_requests
        review.internal_notes = internal_notes
        review.save()
        
        profile.wizard_status = 'changes_requested'
        profile.save()
        
        return Response({
            'success': True,
            'message': 'Change requests sent to borrower',
        })
    
    @action(detail=True, methods=["post"])
    def add_note(self, request, pk=None):
        """Add internal note (not visible to borrower)."""
        profile = self.get_object()
        
        if not request.user.is_superuser:
            return Response(
                {'error': 'Only admins can add notes'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        note = request.data.get('note', '')
        review, _ = BorrowerProfileReview.objects.get_or_create(borrower=profile)
        review.internal_notes = f"{review.internal_notes}\n\n[{timezone.now().strftime('%Y-%m-%d %H:%M')}] {note}"
        review.save()
        
        return Response({
            'success': True,
            'message': 'Note added',
        })
