"""Serializers for borrowers."""
from __future__ import annotations

from rest_framework import serializers

from .models import BorrowerProfile


class BorrowerProfileSerializer(serializers.ModelSerializer):
    """Serializes BorrowerProfile for API representation."""
    
    user = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()

    class Meta:
        model = BorrowerProfile
        exclude = []  # Include all fields
    
    def get_user(self, obj):
        """Return user ID for reference."""
        return obj.user.id if obj.user else None
    
    def get_user_email(self, obj):
        """Return user email safely."""
        try:
            return obj.user.email if obj.user else None
        except:
            return None