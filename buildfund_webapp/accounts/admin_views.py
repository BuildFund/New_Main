"""Admin views for user management."""
from __future__ import annotations

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Q

from accounts.permissions import IsAdmin
from accounts.serializers import UserSerializer
from borrowers.models import BorrowerProfile
from lenders.models import LenderProfile

User = get_user_model()


class AdminUserManagementViewSet(viewsets.ViewSet):
    """ViewSet for admin user management operations."""
    
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    @action(detail=False, methods=["get"])
    def pending_approvals(self, request):
        """Get list of users pending approval (lenders/borrowers without active status)."""
        # Get borrowers without verified company
        borrowers = BorrowerProfile.objects.filter(
            user__is_active=True
        ).select_related("user")
        
        # Get lenders without verified status
        lenders = LenderProfile.objects.filter(
            user__is_active=True
        ).select_related("user")
        
        borrower_data = [
            {
                "id": b.user.id,
                "username": b.user.username,
                "email": b.user.email,
                "type": "borrower",
                "company_name": b.company_name,
                "registration_number": b.registration_number,
                "created_at": b.user.date_joined.isoformat(),
            }
            for b in borrowers
        ]
        
        lender_data = [
            {
                "id": l.user.id,
                "username": l.user.username,
                "email": l.user.email,
                "type": "lender",
                "organisation_name": l.organisation_name,
                "company_number": l.company_number,
                "created_at": l.user.date_joined.isoformat(),
            }
            for l in lenders
        ]
        
        return Response({
            "borrowers": borrower_data,
            "lenders": lender_data,
        })
    
    @action(detail=True, methods=["post"])
    def approve_user(self, request, pk=None):
        """Approve a user (activate their account)."""
        try:
            user = User.objects.get(pk=pk)
            user.is_active = True
            user.save()
            
            # Send email notification
            try:
                from notifications.services import EmailNotificationService
                subject = "Your BuildFund Account Has Been Approved"
                message = f"""
Your BuildFund account has been approved!

You can now log in and start using the platform.

Best regards,
BuildFund Team
                """.strip()
                EmailNotificationService.send_email(
                    subject=subject,
                    message=message,
                    recipient_list=[user.email],
                )
            except Exception as e:
                print(f"Failed to send approval email: {e}")
            
            return Response({"status": "approved", "message": "User approved successfully"})
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
    
    @action(detail=True, methods=["post"])
    def suspend_user(self, request, pk=None):
        """Suspend a user account."""
        try:
            user = User.objects.get(pk=pk)
            user.is_active = False
            user.save()
            
            return Response({"status": "suspended", "message": "User suspended successfully"})
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
    
    @action(detail=True, methods=["post"])
    def activate_user(self, request, pk=None):
        """Activate a suspended user account."""
        try:
            user = User.objects.get(pk=pk)
            user.is_active = True
            user.save()
            
            return Response({"status": "activated", "message": "User activated successfully"})
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
    
    @action(detail=False, methods=["get"])
    def user_stats(self, request):
        """Get user statistics for admin dashboard."""
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        borrowers = BorrowerProfile.objects.count()
        lenders = LenderProfile.objects.count()
        admins = User.objects.filter(is_superuser=True).count()
        
        return Response({
            "total_users": total_users,
            "active_users": active_users,
            "suspended_users": total_users - active_users,
            "borrowers": borrowers,
            "lenders": lenders,
            "admins": admins,
        })
