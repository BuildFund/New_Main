"""Serializers for funding requests."""
from rest_framework import serializers
from .models import FundingRequest


class FundingRequestSerializer(serializers.ModelSerializer):
    """Serializer for FundingRequest."""
    
    funding_type_display = serializers.CharField(source="get_funding_type_display", read_only=True)
    borrower_name = serializers.CharField(source="borrower.user.get_full_name", read_only=True)
    borrower_email = serializers.EmailField(source="borrower.user.email", read_only=True)
    
    class Meta:
        model = FundingRequest
        fields = [
            "id",
            "borrower",
            "borrower_name",
            "borrower_email",
            "funding_type",
            "funding_type_display",
            "request_reference",
            "amount_required",
            "term_required_months",
            "purpose",
            "description",
            "funding_specific_data",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "request_reference", "created_at", "updated_at"]
