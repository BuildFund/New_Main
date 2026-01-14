"""Serializers for applications."""
from __future__ import annotations

from rest_framework import serializers
from core.validators import validate_numeric_input, sanitize_string

from .models import Application, InformationRequest, InformationRequestItem
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


class InformationRequestItemSerializer(serializers.ModelSerializer):
    """Serializer for InformationRequestItem."""
    
    document_type_name = serializers.CharField(source='document_type.name', read_only=True)
    uploaded_document_url = serializers.SerializerMethodField()
    
    class Meta:
        model = InformationRequestItem
        fields = [
            'id', 'title', 'description', 'due_date', 'document_type', 'document_type_name',
            'status', 'uploaded_document', 'uploaded_document_url', 'lender_comment',
            'reviewed_by', 'reviewed_at', 'rework_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'uploaded_document', 'reviewed_by', 'reviewed_at', 'rework_count', 'created_at', 'updated_at']
    
    def get_uploaded_document_url(self, obj):
        if obj.uploaded_document:
            return f"/api/documents/{obj.uploaded_document.id}/download/"
        return None


class InformationRequestSerializer(serializers.ModelSerializer):
    """Serializer for InformationRequest."""
    
    items = InformationRequestItemSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = InformationRequest
        fields = [
            'id', 'application', 'lender', 'title', 'notes', 'items',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'lender', 'created_by', 'created_at', 'updated_at']


class InformationRequestCreateSerializer(serializers.Serializer):
    """Serializer for creating InformationRequest with nested items."""
    
    title = serializers.CharField(max_length=255)
    notes = serializers.CharField(required=False, allow_blank=True)
    items = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        help_text="List of request items"
    )
    
    def validate_items(self, value):
        """Validate items structure."""
        for item in value:
            if 'title' not in item:
                raise serializers.ValidationError("Each item must have a 'title'")
        return value
    
    def create(self, validated_data):
        """Create InformationRequest with items."""
        application = self.context['application']
        user = self.context['request'].user
        lender = application.lender
        
        # Create the request
        request_obj = InformationRequest.objects.create(
            application=application,
            lender=lender,
            title=validated_data['title'],
            notes=validated_data.get('notes', ''),
            created_by=user
        )
        
        # Create items
        items_data = validated_data['items']
        for item_data in items_data:
            # Handle due_date - convert string to date if provided
            due_date = item_data.get('due_date')
            if due_date and isinstance(due_date, str):
                from datetime import datetime
                try:
                    due_date = datetime.strptime(due_date, '%Y-%m-%d').date()
                except ValueError:
                    due_date = None
            
            # Handle document_type_id - convert to int if provided
            document_type_id = item_data.get('document_type_id')
            if document_type_id:
                try:
                    document_type_id = int(document_type_id) if str(document_type_id).strip() else None
                except (ValueError, TypeError):
                    document_type_id = None
            
            InformationRequestItem.objects.create(
                request=request_obj,
                title=item_data['title'],
                description=item_data.get('description', ''),
                due_date=due_date,
                document_type_id=document_type_id,
            )
        
        return request_obj