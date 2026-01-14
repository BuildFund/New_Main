"""Serializers for projects."""
from __future__ import annotations

from rest_framework import serializers
from core.validators import sanitize_string, validate_postcode, validate_numeric_input

from .models import Project


class ProjectSerializer(serializers.ModelSerializer):
    """Serializes Project model for API operations."""
    
    project_reference = serializers.CharField(read_only=True, allow_null=True, allow_blank=True, required=False)

    class Meta:
        model = Project
        exclude = ["borrower", "status", "created_at", "updated_at"]
    
    def to_representation(self, instance):
        """Override to handle project_reference safely."""
        try:
            data = super().to_representation(instance)
            # Ensure project_reference is handled correctly
            if 'project_reference' in data and data['project_reference'] is None:
                data['project_reference'] = None
            return data
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error serializing project {getattr(instance, 'id', 'unknown')}: {e}", exc_info=True)
            # Return basic data if serialization fails
            return {
                'id': getattr(instance, 'id', None),
                'address': getattr(instance, 'address', ''),
                'town': getattr(instance, 'town', ''),
                'project_reference': getattr(instance, 'project_reference', None),
            }
    
    def validate_address(self, value):
        """Sanitize address field."""
        return sanitize_string(value, max_length=255)
    
    def validate_town(self, value):
        """Sanitize town field."""
        return sanitize_string(value, max_length=100)
    
    def validate_county(self, value):
        """Sanitize county field."""
        return sanitize_string(value, max_length=100)
    
    def validate_postcode(self, value):
        """Validate and format postcode."""
        if value:
            try:
                return validate_postcode(value)
            except Exception as e:
                raise serializers.ValidationError(str(e))
        return value
    
    def validate_description(self, value):
        """Sanitize description field."""
        if value:
            return sanitize_string(value, max_length=5000)
        return value
    
    def validate_loan_amount_required(self, value):
        """Validate loan amount is positive."""
        try:
            value = validate_numeric_input(value, min_value=0, max_value=1000000000)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_term_required_months(self, value):
        """Validate term is reasonable."""
        if value is None:
            return None  # Allow None for non-property funding types
        try:
            value = int(validate_numeric_input(value, min_value=1, max_value=600))  # Max 50 years
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value

    def create(self, validated_data):
        request = self.context.get("request")
        if request is None or not hasattr(request.user, "borrowerprofile"):
            raise serializers.ValidationError("Only borrowers can create projects.")
        validated_data["borrower"] = request.user.borrowerprofile
        return Project.objects.create(**validated_data)