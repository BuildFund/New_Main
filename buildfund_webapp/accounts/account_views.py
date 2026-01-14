"""Account management views for users."""
from __future__ import annotations

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction

from .serializers import UserSerializer, MeSerializer
from core.validators import validate_email, sanitize_string

User = get_user_model()


class AccountManagementViewSet(viewsets.ViewSet):
    """ViewSet for account management operations."""
    
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=["get", "put", "patch"])
    def me(self, request):
        """Get or update current user's account information."""
        user = request.user
        
        if request.method == "GET":
            serializer = MeSerializer(user)
            return Response(serializer.data)
        
        elif request.method in ["PUT", "PATCH"]:
            data = request.data.copy()
            
            # Validate email if provided
            if "email" in data:
                email = data["email"].strip().lower()
                if not validate_email(email):
                    return Response(
                        {"error": "Invalid email address"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                # Check if email is already taken by another user
                if User.objects.filter(email=email).exclude(pk=user.pk).exists():
                    return Response(
                        {"error": "This email is already registered"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                data["email"] = email
            
            # Validate username if provided
            if "username" in data:
                username = sanitize_string(data["username"], max_length=150)
                # Check if username is already taken by another user
                if User.objects.filter(username=username).exclude(pk=user.pk).exists():
                    return Response(
                        {"error": "This username is already taken"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                data["username"] = username
            
            # Update user
            serializer = MeSerializer(user, data=data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=["post"])
    def change_password(self, request):
        """Change user's password."""
        user = request.user
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")
        confirm_password = request.data.get("confirm_password")
        
        if not old_password or not new_password or not confirm_password:
            return Response(
                {"error": "All password fields are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify old password
        if not check_password(old_password, user.password):
            return Response(
                {"error": "Current password is incorrect"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate new password
        if len(new_password) < 12:
            return Response(
                {"error": "Password must be at least 12 characters long"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if new_password != confirm_password:
            return Response(
                {"error": "New passwords do not match"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if new password is same as old
        if check_password(new_password, user.password):
            return Response(
                {"error": "New password must be different from current password"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update password
        user.set_password(new_password)
        user.save()
        
        return Response({"message": "Password changed successfully"})
    
    @action(detail=False, methods=["get", "post"])
    def team_members(self, request):
        """Get or create team members for organization (lenders only)."""
        if not hasattr(request.user, "lenderprofile"):
            return Response(
                {"error": "Only lenders can manage team members"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        lender_profile = request.user.lenderprofile
        
        if request.method == "GET":
            # Get all users associated with this lender organization
            # For now, we'll return users with the same organization name
            # In a more complex system, you'd have an Organization model
            team_members = User.objects.filter(
                lenderprofile__organisation_name=lender_profile.organisation_name
            ).exclude(pk=request.user.pk)
            
            serializer = MeSerializer(team_members, many=True)
            return Response(serializer.data)
        
        elif request.method == "POST":
            # Create a new team member
            username = request.data.get("username")
            email = request.data.get("email")
            password = request.data.get("password")
            first_name = request.data.get("first_name", "")
            last_name = request.data.get("last_name", "")
            
            if not username or not email or not password:
                return Response(
                    {"error": "Username, email, and password are required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate email
            email = email.strip().lower()
            if not validate_email(email):
                return Response(
                    {"error": "Invalid email address"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate password
            if len(password) < 12:
                return Response(
                    {"error": "Password must be at least 12 characters long"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if user already exists
            if User.objects.filter(username=username).exists():
                return Response(
                    {"error": "Username already exists"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if User.objects.filter(email=email).exists():
                return Response(
                    {"error": "Email already registered"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create user and lender profile
            with transaction.atomic():
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                )
                
                # Create lender profile for team member
                from lenders.models import LenderProfile
                from accounts.models import Role, UserRole
                
                LenderProfile.objects.create(
                    user=user,
                    organisation_name=lender_profile.organisation_name,
                    company_number=lender_profile.company_number,
                    fca_registration_number=lender_profile.fca_registration_number,
                    contact_email=email,
                )
                
                # Assign Lender role
                lender_role, _ = Role.objects.get_or_create(name=Role.LENDER)
                UserRole.objects.create(user=user, role=lender_role)
            
            serializer = MeSerializer(user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=["delete", "put", "patch"])
    def team_member(self, request, pk=None):
        """Manage a specific team member."""
        if not hasattr(request.user, "lenderprofile"):
            return Response(
                {"error": "Only lenders can manage team members"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        lender_profile = request.user.lenderprofile
        
        try:
            team_member = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"error": "Team member not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify team member belongs to same organization
        if not hasattr(team_member, "lenderprofile") or \
           team_member.lenderprofile.organisation_name != lender_profile.organisation_name:
            return Response(
                {"error": "You can only manage team members from your organization"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if request.method == "DELETE":
            # Deactivate user instead of deleting
            team_member.is_active = False
            team_member.save()
            return Response({"message": "Team member deactivated successfully"})
        
        elif request.method in ["PUT", "PATCH"]:
            # Update team member
            data = request.data.copy()
            
            if "email" in data:
                email = data["email"].strip().lower()
                if not validate_email(email):
                    return Response(
                        {"error": "Invalid email address"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if User.objects.filter(email=email).exclude(pk=team_member.pk).exists():
                    return Response(
                        {"error": "This email is already registered"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                data["email"] = email
            
            serializer = MeSerializer(team_member, data=data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=["post"])
    def reset_team_member_password(self, request, pk=None):
        """Reset a team member's password (lenders only)."""
        if not hasattr(request.user, "lenderprofile"):
            return Response(
                {"error": "Only lenders can reset team member passwords"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        lender_profile = request.user.lenderprofile
        
        try:
            team_member = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"error": "Team member not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify team member belongs to same organization
        if not hasattr(team_member, "lenderprofile") or \
           team_member.lenderprofile.organisation_name != lender_profile.organisation_name:
            return Response(
                {"error": "You can only reset passwords for team members from your organization"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        new_password = request.data.get("new_password")
        confirm_password = request.data.get("confirm_password")
        
        if not new_password or not confirm_password:
            return Response(
                {"error": "Both password fields are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(new_password) < 12:
            return Response(
                {"error": "Password must be at least 12 characters long"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if new_password != confirm_password:
            return Response(
                {"error": "Passwords do not match"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        team_member.set_password(new_password)
        team_member.save()
        
        return Response({"message": "Password reset successfully"})
