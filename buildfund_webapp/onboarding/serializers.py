"""Serializers for onboarding app."""
from __future__ import annotations

from rest_framework import serializers
from core.validators import validate_email, sanitize_string, validate_postcode, validate_company_number
from .models import OnboardingProgress, OnboardingData, OnboardingSession


class OnboardingProgressSerializer(serializers.ModelSerializer):
    """Serializer for onboarding progress."""
    
    class Meta:
        model = OnboardingProgress
        fields = [
            "is_complete",
            "completion_percentage",
            "current_step",
            "last_updated",
            "started_at",
            "completed_at",
            "profile_complete",
            "contact_complete",
            "company_complete",
            "address_complete",
            "financial_complete",
            "documents_complete",
            "company_verified",
            "address_verified",
            "verification_score",
        ]
        read_only_fields = [
            "is_complete",
            "completion_percentage",
            "last_updated",
            "started_at",
            "completed_at",
        ]


class OnboardingDataSerializer(serializers.ModelSerializer):
    """Serializer for onboarding data."""
    
    class Meta:
        model = OnboardingData
        fields = "__all__"
        read_only_fields = ["user", "created_at", "updated_at"]


class OnboardingSessionSerializer(serializers.ModelSerializer):
    """Serializer for onboarding session."""
    
    class Meta:
        model = OnboardingSession
        fields = [
            "id",
            "session_id",
            "current_step",
            "conversation_history",
            "collected_data",
            "started_at",
            "last_activity",
            "is_active",
        ]
        read_only_fields = ["id", "session_id", "started_at", "last_activity"]


class ChatbotMessageSerializer(serializers.Serializer):
    """Serializer for chatbot messages."""
    
    message = serializers.CharField(required=True)
    step = serializers.CharField(required=False, allow_blank=True)
    session_id = serializers.CharField(required=False, allow_blank=True)
