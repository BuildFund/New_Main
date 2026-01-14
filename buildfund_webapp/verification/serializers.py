"""Serializers for verification models."""
from __future__ import annotations

from rest_framework import serializers
from .models import CompanyVerification, DirectorVerification


class CompanyVerificationSerializer(serializers.ModelSerializer):
    """Serializer for CompanyVerification model."""
    
    class Meta:
        model = CompanyVerification
        fields = [
            "id",
            "company_number",
            "company_name",
            "status",
            "verified_at",
            "verification_data",
            "error_message",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "verified_at",
            "verification_data",
            "error_message",
            "created_at",
            "updated_at",
        ]


class DirectorVerificationSerializer(serializers.ModelSerializer):
    """Serializer for DirectorVerification model."""
    
    class Meta:
        model = DirectorVerification
        fields = [
            "id",
            "company_number",
            "director_name",
            "date_of_birth",
            "status",
            "verified_at",
            "verification_data",
            "error_message",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "verified_at",
            "verification_data",
            "error_message",
            "created_at",
            "updated_at",
        ]
