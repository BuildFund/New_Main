"""Views for lender operations."""
from __future__ import annotations

from rest_framework import mixins, permissions, viewsets

from .models import LenderProfile
from .serializers import LenderProfileSerializer


class IsOwner(permissions.BasePermission):
    """Custom permission to ensure lenders only access their own profile."""

    def has_object_permission(self, request, view, obj) -> bool:
        return obj.user == request.user


class LenderProfileViewSet(
    mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    """ViewSet for lenders to view, update or list their profile.

    The list endpoint returns a single profile associated with the
    authenticated user.  Adding ListModelMixin makes it easy for
    front‑end applications to fetch the current profile without
    knowing its ID in advance.
    """

    serializer_class = LenderProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return LenderProfile.objects.filter(user=self.request.user)