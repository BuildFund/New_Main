"""Serializers for the private equity module."""

from __future__ import annotations

from rest_framework import serializers

from .models import PrivateEquityOpportunity, PrivateEquityInvestment


class PrivateEquityOpportunitySerializer(serializers.ModelSerializer):
    """
    Serializer for creating and retrieving private equity opportunities.
    The borrower field is read-only; it is set to the current borrower
    automatically when a new opportunity is created.
    """
    borrower = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = PrivateEquityOpportunity
        fields = [
            "id",
            "borrower",
            "title",
            "description",
            "industry",
            "funding_required",
            "valuation",
            "share_offered",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "borrower", "status", "created_at", "updated_at"]

    def create(self, validated_data):
        """
        Create a new private equity opportunity for the current borrower.

        When a borrower submits a new opportunity it should immediately be
        marked as ``pending_review`` so that it enters the admin review
        workflow rather than remaining in a permanent draft state.  If the
        request does not originate from a borrower the call will fail.
        """
        request = self.context.get("request")
        if not request or not hasattr(request.user, "borrowerprofile"):
            raise serializers.ValidationError("Only borrowers can create private equity opportunities.")
        borrower = request.user.borrowerprofile
        # Force status to pending_review on creation to ensure the admin can
        # review and approve submissions.  ``validated_data`` may still
        # contain a status value but it will be ignored here for security.
        validated_data.pop("status", None)
        return PrivateEquityOpportunity.objects.create(
            borrower=borrower, status="pending_review", **validated_data
        )


class PrivateEquityInvestmentSerializer(serializers.ModelSerializer):
    """
    Serializer for investor investments into private equity opportunities.
    The lender is set from the current user; status is read-only.
    """

    class Meta:
        model = PrivateEquityInvestment
        fields = [
            "id",
            "opportunity",
            "lender",
            "amount",
            "share",
            "notes",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "lender", "status", "created_at", "updated_at"]

    def create(self, validated_data):
        request = self.context.get("request")
        if not request or not hasattr(request.user, "lenderprofile"):
            raise serializers.ValidationError("Only lenders can invest in private equity opportunities.")
        lender = request.user.lenderprofile
        return PrivateEquityInvestment.objects.create(lender=lender, **validated_data)