"""Models for user roles and profiles.

This app defines the Role model used to assign roles to users.  It relies
on Django's built‑in User model (django.contrib.auth.models.User) for
authentication.  Additional profile information is stored in the
borrowers and lenders apps.
"""
from __future__ import annotations

from django.conf import settings
from django.db import models


class Role(models.Model):
    """Represents a system role (Borrower, Lender, Consultant, Admin)."""

    BORROWER = "Borrower"
    LENDER = "Lender"
    CONSULTANT = "Consultant"
    ADMIN = "Admin"
    ROLE_CHOICES = [
        (BORROWER, BORROWER),
        (LENDER, LENDER),
        (CONSULTANT, CONSULTANT),
        (ADMIN, ADMIN),
    ]

    name = models.CharField(max_length=20, unique=True, choices=ROLE_CHOICES)

    def __str__(self) -> str:  # pragma: no cover
        return self.name


class UserRole(models.Model):
    """Associates a user with a role."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("user", "role")

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.user.email} → {self.role.name}"