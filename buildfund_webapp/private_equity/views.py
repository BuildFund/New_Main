"""Views for the private equity module."""

from __future__ import annotations

from rest_framework import permissions, viewsets
from rest_framework.decorators import action  # type: ignore
from rest_framework.response import Response

from accounts.permissions import IsAdmin, IsBorrower, IsLender
from rest_framework.exceptions import PermissionDenied

from .models import PrivateEquityOpportunity, PrivateEquityInvestment
from .serializers import (
    PrivateEquityOpportunitySerializer,
    PrivateEquityInvestmentSerializer,
)
from .certification_views import check_certification


class PrivateEquityOpportunityViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing private equity opportunities.  Borrowers can
    create and manage their own opportunities.  Administrators can
    approve or decline submissions.  Lenders and other authenticated
    users can list approved opportunities.
    """

    serializer_class = PrivateEquityOpportunitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Borrowers see their own opportunities (no certification needed for their own)
        if hasattr(user, "borrowerprofile"):
            return PrivateEquityOpportunity.objects.filter(borrower=user.borrowerprofile)
        # Admins see all (no certification needed)
        if IsAdmin().has_permission(self.request, self):
            return PrivateEquityOpportunity.objects.all()
        # Others (lenders/investors) need FCA certification to view approved opportunities
        if not check_certification(user):
            raise PermissionDenied(
                "FCA self-certification is required to access Private Equity opportunities. "
                "Please complete the self-certification process first."
            )
        # Others see only approved opportunities
        return PrivateEquityOpportunity.objects.filter(status="approved")

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [permissions.IsAuthenticated(), IsBorrower()]
        if self.action == "approve":
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=["post"])  # type: ignore[misc]
    def approve(self, request, pk: str | None = None):
        """
        Admin action to approve a private equity opportunity.  Sets status
        to "approved".  Only administrators or superusers may perform
        this action.
        """
        opportunity = self.get_object()
        if opportunity.status != "approved":
            opportunity.status = "approved"
            opportunity.save(update_fields=["status"])
        serializer = self.get_serializer(opportunity)
        return Response(serializer.data)


class PrivateEquityInvestmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing investments in private equity opportunities.
    Lenders can create offers (investments) on approved opportunities.
    Borrowers can view investments on their opportunities.  Admins
    see all investments.
    """

    serializer_class = PrivateEquityInvestmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "lenderprofile"):
            # Lenders need FCA certification to create/view investments
            if not check_certification(user):
                raise PermissionDenied(
                    "FCA self-certification is required to access Private Equity investments. "
                    "Please complete the self-certification process first."
                )
            return PrivateEquityInvestment.objects.filter(lender=user.lenderprofile)
        if hasattr(user, "borrowerprofile"):
            # Borrowers see investments on their opportunities (no certification needed for their own)
            return PrivateEquityInvestment.objects.filter(opportunity__borrower=user.borrowerprofile)
        # Admins see all (no certification needed)
        if IsAdmin().has_permission(self.request, self):
            return PrivateEquityInvestment.objects.all()
        # Others see none
        return PrivateEquityInvestment.objects.none()

    def get_permissions(self):
        if self.action == "create":
            # Only lenders can create investments
            return [permissions.IsAuthenticated(), IsLender()]
        if self.action in {"update", "partial_update", "destroy"}:
            # Only the lender who created the investment or an admin can modify
            return [permissions.IsAuthenticated(), self.AdminOrOwnerPermission()]
        return [permissions.IsAuthenticated()]

    class AdminOrOwnerPermission(permissions.BasePermission):
        def has_object_permission(self, request, view, obj):
            return IsAdmin().has_permission(request, view) or (
                hasattr(request.user, "lenderprofile") and obj.lender == request.user.lenderprofile
            )