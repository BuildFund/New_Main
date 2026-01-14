"""Serializers for products."""
from __future__ import annotations

from rest_framework import serializers
from core.validators import sanitize_string, validate_numeric_input

from .models import Product, FavouriteProduct


class ProductSerializer(serializers.ModelSerializer):
    """Serializes Product for API representation and creation."""

    class Meta:
        model = Product
        fields = [
            "id",
            "lender",
            "name",
            "description",
            "funding_type",
            "property_type",
            "min_loan_amount",
            "max_loan_amount",
            "interest_rate_min",
            "interest_rate_max",
            "term_min_months",
            "term_max_months",
            "max_ltv_ratio",
            "repayment_structure",
            "eligibility_criteria",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "lender"]

    def validate_name(self, value):
        """Sanitize product name."""
        return sanitize_string(value, max_length=100)
    
    def validate_description(self, value):
        """Sanitize description field."""
        if value:
            return sanitize_string(value, max_length=5000)
        return value
    
    def validate_min_loan_amount(self, value):
        """Validate minimum loan amount."""
        try:
            value = validate_numeric_input(value, min_value=0, max_value=1000000000)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_max_loan_amount(self, value):
        """Validate maximum loan amount."""
        try:
            value = validate_numeric_input(value, min_value=0, max_value=1000000000)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_interest_rate_min(self, value):
        """Validate minimum interest rate."""
        try:
            value = validate_numeric_input(value, min_value=0, max_value=100)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_interest_rate_max(self, value):
        """Validate maximum interest rate."""
        try:
            value = validate_numeric_input(value, min_value=0, max_value=100)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_max_ltv_ratio(self, value):
        """Validate max LTV ratio."""
        try:
            value = validate_numeric_input(value, min_value=0, max_value=100)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_eligibility_criteria(self, value):
        """Sanitize eligibility criteria."""
        if value:
            return sanitize_string(value, max_length=5000)
        return value
    
    def validate(self, attrs):
        """Cross-field validation."""
        # Ensure min < max for loan amounts
        if attrs.get("min_loan_amount") and attrs.get("max_loan_amount"):
            if attrs["min_loan_amount"] > attrs["max_loan_amount"]:
                raise serializers.ValidationError(
                    "Minimum loan amount must be less than maximum loan amount"
                )
        
        # Ensure min < max for interest rates
        if attrs.get("interest_rate_min") and attrs.get("interest_rate_max"):
            if attrs["interest_rate_min"] > attrs["interest_rate_max"]:
                raise serializers.ValidationError(
                    "Minimum interest rate must be less than maximum interest rate"
                )
        
        # Ensure min < max for terms
        if attrs.get("term_min_months") and attrs.get("term_max_months"):
            if attrs["term_min_months"] > attrs["term_max_months"]:
                raise serializers.ValidationError(
                    "Minimum term must be less than maximum term"
                )
        
        return attrs

    def create(self, validated_data):
        # Assign the product to the current user's lender profile
        request = self.context.get("request")
        if request is None or not hasattr(request.user, "lenderprofile"):
            raise serializers.ValidationError("Only lenders can create products.")
        validated_data["lender"] = request.user.lenderprofile
        return super().create(validated_data)
    
    def to_representation(self, instance):
        """Add lender details to the serialized output."""
        data = super().to_representation(instance)
        if instance.lender:
            data['lender_details'] = {
                'id': instance.lender.id,
                'organisation_name': instance.lender.organisation_name,
                'contact_email': instance.lender.contact_email,
                'contact_phone': instance.lender.contact_phone,
            }
        return data


class FavouriteProductSerializer(serializers.ModelSerializer):
    """Serializer for FavouriteProduct."""
    
    product = ProductSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True)
    project_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = FavouriteProduct
        fields = [
            "id",
            "borrower",
            "product",
            "product_id",
            "project",
            "project_id",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "borrower", "product", "project", "created_at", "updated_at"]
    
    def create(self, validated_data):
        """Create a favourite product for the current borrower."""
        request = self.context.get("request")
        if not request or not hasattr(request.user, "borrowerprofile"):
            raise serializers.ValidationError("Only borrowers can favourite products.")
        
        validated_data["borrower"] = request.user.borrowerprofile
        product_id = validated_data.pop("product_id")
        project_id = validated_data.pop("project_id", None)
        
        from products.models import Product
        from projects.models import Project
        
        product = Product.objects.get(id=product_id)
        validated_data["product"] = product
        
        if project_id:
            project = Project.objects.get(id=project_id)
            validated_data["project"] = project
        
        return super().create(validated_data)