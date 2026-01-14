"""Custom permission classes for role-based access control.

This module defines reusable permission classes for checking if a
requesting user has a particular system role.  These classes can be
imported by viewsets in other apps without creating circular
dependencies.
"""
from __future__ import annotations

from rest_framework import permissions
from accounts.models import Role


class IsAdmin(permissions.BasePermission):
    """
    Allows access only to users with the Admin role or superuser status.

    The permission checks the authenticated user's associated roles via
    ``UserRole``.  Superusers automatically satisfy this permission.
    """

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return user.userrole_set.filter(role__name=Role.ADMIN).exists()


class IsLender(permissions.BasePermission):
    """
    Allows access only to users who have a lender profile.  Use this
    permission to restrict create/update actions on lender-managed
    resources.
    """

    def has_permission(self, request, view) -> bool:
        return request.user.is_authenticated and hasattr(request.user, "lenderprofile")


class IsBorrower(permissions.BasePermission):
    """
    Allows access only to users with a borrower profile.
    """

    def has_permission(self, request, view) -> bool:
        return request.user.is_authenticated and hasattr(request.user, "borrowerprofile")