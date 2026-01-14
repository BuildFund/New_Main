"""Views for funding requests."""
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from decimal import Decimal

from .models import FundingRequest
from .serializers import FundingRequestSerializer
from products.models import Product


class FundingRequestViewSet(viewsets.ModelViewSet):
    """ViewSet for funding requests (non-property funding)."""
    
    serializer_class = FundingRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "borrowerprofile"):
            return FundingRequest.objects.filter(borrower=user.borrowerprofile)
        elif user.is_staff:
            return FundingRequest.objects.all()
        return FundingRequest.objects.none()
    
    def perform_create(self, serializer):
        borrower = self.request.user.borrowerprofile
        serializer.save(borrower=borrower)
    
    @action(detail=True, methods=["get"], url_path="matched-products")
    def matched_products(self, request, pk: str | None = None):
        """
        Return a list of lender products that match this funding request's criteria.
        
        Matching is based on funding type, loan amount, and term.
        For non-property funding types, property_type is not required.
        """
        funding_request = self.get_object()
        from products.serializers import ProductSerializer
        
        # Base queryset: active products matching funding type
        qs = Product.objects.filter(
            status="active",
            funding_type=funding_request.funding_type,
        )
        
        # For non-property funding types, property_type may not be relevant
        # But we still filter if it's set in the product
        
        # Filter by loan amount
        qs = qs.filter(
            min_loan_amount__lte=funding_request.amount_required,
            max_loan_amount__gte=funding_request.amount_required,
        )
        
        # Filter by term if specified
        if funding_request.term_required_months:
            qs = qs.filter(
                term_min_months__lte=funding_request.term_required_months,
                term_max_months__gte=funding_request.term_required_months,
            )
        
        # Compute match score (loan amount proximity)
        def score(product: Product) -> float:
            median = (product.min_loan_amount + product.max_loan_amount) / 2
            loan_diff = abs(float(median) - float(funding_request.amount_required))
            return loan_diff
        
        sorted_products = sorted(qs, key=score)
        serializer = ProductSerializer(sorted_products, many=True, context={"request": request})
        return Response(serializer.data)
    
    @action(detail=True, methods=["post"], url_path="submit-enquiry")
    def submit_enquiry(self, request, pk: str | None = None):
        """
        Allow borrowers to submit an enquiry about a matched product.
        Creates an application linking the funding request to the product.
        """
        funding_request = self.get_object()
        product_id = request.data.get("product_id")
        notes = request.data.get("notes", "")
        
        if not product_id:
            return Response(
                {"error": "product_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            product = Product.objects.get(id=product_id, status="active")
        except Product.DoesNotExist:
            return Response(
                {"error": "Product not found or not active"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify product matches funding request criteria
        if (product.funding_type != funding_request.funding_type or
            product.min_loan_amount > funding_request.amount_required or
            product.max_loan_amount < funding_request.amount_required):
            return Response(
                {"error": "Product does not match funding request criteria"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create application (we need to create a Project or handle this differently)
        # For now, we'll create a minimal project or use a different approach
        from applications.models import Application
        from projects.models import Project
        
        # Create a minimal project for non-property funding
        # Or we could extend Application to work with FundingRequest directly
        # For now, let's create a placeholder project
        project, _ = Project.objects.get_or_create(
            borrower=funding_request.borrower,
            funding_type=funding_request.funding_type,
            property_type="commercial",  # Default for non-property
            address="N/A - Business Finance",
            town="N/A",
            county="N/A",
            postcode="N/A",
            description=funding_request.purpose,
            development_extent="new_build",
            tenure="freehold",
            loan_amount_required=funding_request.amount_required,
            term_required_months=funding_request.term_required_months or 12,
            repayment_method="refinance",
            defaults={"status": "pending_review"}
        )
        
        # Create application
        application, created = Application.objects.get_or_create(
            project=project,
            lender=product.lender,
            product=product,
            defaults={
                "proposed_loan_amount": funding_request.amount_required,
                "proposed_term_months": funding_request.term_required_months or 12,
                "proposed_interest_rate": product.interest_rate_min,
                "notes": notes,
                "initiated_by": "borrower",
                "status": "submitted",
            }
        )
        
        if not created:
            return Response(
                {"error": "Application already exists for this product"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from applications.serializers import ApplicationSerializer
        serializer = ApplicationSerializer(application, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
