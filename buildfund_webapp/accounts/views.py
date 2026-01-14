"""Views for the accounts app."""
from __future__ import annotations

from django.contrib.auth.models import User
from rest_framework import generics, permissions

from .models import Role
from .serializers import RoleSerializer, UserSerializer, MeSerializer
from .throttles import LoginRateThrottle


class UserRegistrationView(generics.CreateAPIView):
    """Allows new users to register.

    Requires no authentication.  Validation ensures that passwords
    meet minimum length requirements.  Roles may be assigned at
    registration but can also be added later by an admin.
    Protected by rate limiting to prevent spam registrations.
    """

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginRateThrottle]  # Prevent spam registrations


class RoleListView(generics.ListAPIView):
    """Lists available roles in the system."""

    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.AllowAny]


class CurrentUserView(generics.RetrieveAPIView):
    """
    Returns the current authenticated user's details, including
    username, email and roles.  Requires authentication.
    """

    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):  # pragma: no cover
        return self.request.user