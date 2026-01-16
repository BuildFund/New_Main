"""Serializers for applications."""
from __future__ import annotations

from rest_framework import serializers
from core.validators import validate_numeric_input, sanitize_string

from .models import Application
from projects.models import Project
from products.models import Product


class ApplicationSerializer(serializers.ModelSerializer):
    """Serializes Application model for API operations."""

    project_details = serializers.SerializerMethodField()
    borrower_details = serializers.SerializerMethodField()
    lender_details = serializers.SerializerMethodField()
    product_details = serializers.SerializerMethodField()
    initiated_by = serializers.CharField(read_only=True)
    deal_id = serializers.SerializerMethodField()
    deal_deal_id = serializers.SerializerMethodField()
    
    class Meta:
        model = Application
        fields = [
            "id",
            "project",
            "product",
            "lender",
            "initiated_by",
            "proposed_loan_amount",
            "proposed_interest_rate",
            "proposed_term_months",
            "proposed_ltv_ratio",
            "notes",
            "status",
            "status_feedback",
            "status_changed_at",
            "project_details",
            "borrower_details",
            "lender_details",
            "product_details",
            "deal_id",
            "deal_deal_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "lender", "status_changed_at"]
    
    def get_project_details(self, obj):
        """Return full project details for lenders viewing borrower enquiries."""
        try:
            from projects.serializers import ProjectSerializer
            return ProjectSerializer(obj.project, context=self.context).data
        except Exception as e:
            # Return basic project info if serializer fails
            return {
                'id': obj.project.id if obj.project else None,
                'address': getattr(obj.project, 'address', '') if obj.project else '',
                'town': getattr(obj.project, 'town', '') if obj.project else '',
                'description': getattr(obj.project, 'description', '') if obj.project else '',
            }
    
    def get_borrower_details(self, obj):
        """Return borrower profile details for lenders."""
        try:
            if not obj.project or not obj.project.borrower:
                return {}
            from borrowers.serializers import BorrowerProfileSerializer
            borrower_data = BorrowerProfileSerializer(obj.project.borrower, context=self.context).data
            # Add user info for messaging
            if obj.project.borrower.user:
                borrower_data['user'] = {
                    'id': obj.project.borrower.user.id,
                    'email': obj.project.borrower.user.email,
                    'username': obj.project.borrower.user.username,
                }
            return borrower_data
        except Exception as e:
            # Return basic borrower info if serializer fails
            borrower = obj.project.borrower if obj.project else None
            if not borrower:
                return {}
            return {
                'first_name': getattr(borrower, 'first_name', ''),
                'last_name': getattr(borrower, 'last_name', ''),
                'company_name': getattr(borrower, 'company_name', ''),
                'user': {
                    'id': borrower.user.id if borrower.user else None,
                    'email': borrower.user.email if borrower.user else '',
                } if borrower.user else None,
            }
    
    def get_lender_details(self, obj):
        """Return lender profile details for borrowers."""
        try:
            if not obj.lender:
                return {}
            from lenders.serializers import LenderProfileSerializer
            lender_data = LenderProfileSerializer(obj.lender, context=self.context).data
            # Add user info for messaging
            if obj.lender.user:
                lender_data['user'] = {
                    'id': obj.lender.user.id,
                    'email': obj.lender.user.email,
                    'username': obj.lender.user.username,
                }
            return lender_data
        except Exception as e:
            # Return basic lender info if serializer fails
            if not obj.lender:
                return {}
            return {
                'organisation_name': getattr(obj.lender, 'organisation_name', ''),
                'contact_email': getattr(obj.lender, 'contact_email', ''),
                'user': {
                    'id': obj.lender.user.id if obj.lender.user else None,
                    'email': obj.lender.user.email if obj.lender.user else '',
                } if obj.lender.user else None,
            }
    
    def get_product_details(self, obj):
        """Return product details."""
        try:
            if not obj.product:
                return {}
            from products.serializers import ProductSerializer
            return ProductSerializer(obj.product, context=self.context).data
        except Exception as e:
            # Return basic product info if serializer fails
            if not obj.product:
                return {}
            return {
                'id': obj.product.id,
                'name': getattr(obj.product, 'name', ''),
                'funding_type': getattr(obj.product, 'funding_type', ''),
            }
    
    def get_deal_id(self, obj):
        """Return deal ID if deal exists."""
        if hasattr(obj, 'deal'):
            return obj.deal.id
        return None
    
    def get_deal_deal_id(self, obj):
        """Return deal deal_id (unique identifier) if deal exists."""
        if hasattr(obj, 'deal'):
            return obj.deal.deal_id
        return None

    def validate_proposed_loan_amount(self, value):
        """Validate loan amount is positive and reasonable."""
        try:
            value = validate_numeric_input(value, min_value=0, max_value=1000000000)  # Max £1B
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_proposed_interest_rate(self, value):
        """Validate interest rate is within reasonable bounds."""
        try:
            value = validate_numeric_input(value, min_value=0, max_value=100)  # Max 100%
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_proposed_ltv_ratio(self, value):
        """Validate LTV ratio is within reasonable bounds."""
        try:
            value = validate_numeric_input(value, min_value=0, max_value=100)  # Max 100%
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_notes(self, value):
        """Sanitize notes field."""
        if value:
            return sanitize_string(value, max_length=5000)
        return value
    
    def validate_status_feedback(self, value):
        """Sanitize status_feedback field."""
        if value:
            return sanitize_string(value, max_length=2000)
        return value
    
    def validate(self, attrs):
        request = self.context.get("request")
        if request is None:
            raise serializers.ValidationError("Request context is required.")
        
        project: Project = attrs.get("project")
        product: Product = attrs.get("product")
        
        # Check if user is borrower or lender
        is_borrower = hasattr(request.user, "borrowerprofile")
        is_lender = hasattr(request.user, "lenderprofile")
        
        if not (is_borrower or is_lender):
            raise serializers.ValidationError("Only borrowers and lenders can create applications/enquiries.")
        
        # Borrower enquiry: ensure project belongs to borrower
        if is_borrower:
            if project.borrower != request.user.borrowerprofile:
                raise serializers.ValidationError("You can only create enquiries for your own projects.")
            # For borrower enquiries, lender comes from the product
            lender_profile = product.lender
            validated_data["lender"] = lender_profile
            validated_data["initiated_by"] = "borrower"
            # Set default values for borrower enquiries
            if not attrs.get("proposed_loan_amount"):
                validated_data["proposed_loan_amount"] = project.loan_amount_required
            if not attrs.get("proposed_term_months"):
                validated_data["proposed_term_months"] = project.term_required_months
        
        # Lender application: ensure product belongs to lender
        elif is_lender:
            lender_profile = request.user.lenderprofile
            if product.lender_id != lender_profile.id:
                raise serializers.ValidationError("You may only apply with your own products.")
            validated_data["lender"] = lender_profile
            validated_data["initiated_by"] = "lender"
        
        # Ensure no existing active application for this project-lender pair
        if Application.objects.filter(project=project, lender=lender_profile).exists():
            raise serializers.ValidationError(
                "An application or enquiry already exists for this project and lender combination."
            )
        
        return attrs

    def create(self, validated_data):
        return Application.objects.create(**validated_data)