"""Views for project management."""
from __future__ import annotations

from django.db.models import Q
from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action  # type: ignore
from rest_framework.response import Response

from accounts.permissions import IsAdmin

from .models import Project
from .serializers import ProjectSerializer


class IsBorrower(permissions.BasePermission):
    """Allows access only to users with a borrower profile."""

    def has_permission(self, request, view) -> bool:
        return request.user.is_authenticated and hasattr(request.user, "borrowerprofile")


class ProjectViewSet(viewsets.ModelViewSet):
    """ViewSet for borrowers to create and manage their projects."""

    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """List projects with error handling."""
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in ProjectViewSet.list: {e}", exc_info=True)
            return Response(
                {"error": f"Failed to load projects: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def get_queryset(self):
        """
        Determine the queryset based on the requesting user's role.

        - Borrowers see only their own projects.
        - Administrators see all projects regardless of status.
        - Other authenticated users see only approved projects.
        """
        user = self.request.user
        try:
            # Borrower: only own projects
            if hasattr(user, "borrowerprofile"):
                return Project.objects.filter(borrower=user.borrowerprofile).select_related('borrower', 'borrower__user')
            # Admin: view all projects
            if IsAdmin().has_permission(self.request, self):
                return Project.objects.all().select_related('borrower', 'borrower__user')
            # Others: approved projects only
            return Project.objects.filter(status="approved").select_related('borrower', 'borrower__user')
        except Exception as e:
            # Log error and return empty queryset to prevent 500
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in ProjectViewSet.get_queryset: {e}", exc_info=True)
            return Project.objects.none()

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            permission_classes = [permissions.IsAuthenticated, IsBorrower]
        elif self.action == "approve":
            permission_classes = [permissions.IsAuthenticated, IsAdmin]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [perm() for perm in permission_classes]

    @action(detail=True, methods=["get"], url_path="matched-products")
    def matched_products(self, request, pk: str | None = None):
        """
        Return a list of lender products that match this project's criteria.

        Matching is based on the project's funding type, property type, loan
        amount, term and LTV ratio.  Only products with status "active"
        are considered.  Results are sorted by how closely they fit the
        requested loan amount and term.
        """
        try:
            project = self.get_object()
            from products.models import Product  # import here to avoid circular dependency
            from decimal import Decimal

            # Base queryset: active products matching funding type
            qs = Product.objects.filter(
                status="active",
                funding_type=project.funding_type,
            )
            
            # For property-based funding types, also filter by property type
            # For non-property funding types, property_type may be N/A or not set
            property_based_types = [
                "development_finance", "senior_debt", "commercial_mortgage", 
                "mortgage", "equity"
            ]
            if project.funding_type in property_based_types:
                qs = qs.filter(
                    Q(property_type=project.property_type) | 
                    Q(property_type__isnull=True) | 
                    Q(property_type="n/a")
                )
            # Filter by loan amount and term
            qs = qs.filter(
                min_loan_amount__lte=project.loan_amount_required,
                max_loan_amount__gte=project.loan_amount_required,
            )
            
            # Only filter by term if term_required_months is set
            if project.term_required_months:
                qs = qs.filter(
                    term_min_months__lte=project.term_required_months,
                    term_max_months__gte=project.term_required_months,
                )
            
            # Filter by LTV ratio if project has a calculable LTV
            project_ltv = project.calculate_ltv_ratio()
            if project_ltv is not None:
                # Only include products where the product's max LTV is >= project's LTV
                qs = qs.filter(max_ltv_ratio__gte=Decimal(str(project_ltv)))
            
            # Compute match score (combination of loan amount proximity and LTV fit)
            def score(product: Product) -> float:
                # Loan amount match score (lower is better)
                median = (product.min_loan_amount + product.max_loan_amount) / 2
                loan_diff = abs(float(median) - float(project.loan_amount_required))
                
                # LTV match score (prefer products with max LTV closer to project LTV)
                ltv_score = 0.0
                if project_ltv is not None:
                    # Calculate how close the product's max LTV is to the project's LTV
                    # Products with max LTV closer to project LTV are preferred
                    ltv_diff = abs(float(product.max_ltv_ratio) - project_ltv)
                    ltv_score = ltv_diff * 1000  # Weight LTV difference (scale to match loan diff magnitude)
                
                # Combined score (loan amount difference + LTV difference)
                return loan_diff + ltv_score

            sorted_products = sorted(qs, key=score)
            from products.serializers import ProductSerializer

            serializer = ProductSerializer(sorted_products, many=True, context={"request": request})
            return Response(serializer.data)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in ProjectViewSet.matched_products: {e}", exc_info=True)
            return Response(
                {"error": f"Failed to load matched products: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=["post"], url_path="submit-enquiry")
    def submit_enquiry(self, request, pk: str | None = None):
        """
        Allow borrowers to submit an enquiry about a matched product.
        This creates an Application with initiated_by='borrower'.
        """
        project = self.get_object()
        
        # Check user is the borrower
        if not hasattr(request.user, "borrowerprofile"):
            return Response(
                {"error": "Only borrowers can submit enquiries"},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        if project.borrower != request.user.borrowerprofile:
            return Response(
                {"error": "You can only submit enquiries for your own projects"},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # Get product_id from request
        product_id = request.data.get("product_id")
        if not product_id:
            return Response(
                {"error": "product_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        from products.models import Product
        try:
            product = Product.objects.get(id=product_id, status="active")
        except Product.DoesNotExist:
            return Response(
                {"error": "Product not found or not active"},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        # Verify product matches project criteria
        # Check funding type match
        if product.funding_type != project.funding_type:
            return Response(
                {"error": "Product funding type does not match project"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # For property-based funding types, check property type match
        # For non-property funding types, property_type may be N/A or not set
        property_based_types = [
            "development_finance", "senior_debt", "commercial_mortgage", 
            "mortgage", "equity"
        ]
        if project.funding_type in property_based_types:
            if (product.property_type and 
                product.property_type != "n/a" and 
                product.property_type != project.property_type):
                return Response(
                    {"error": "Product property type does not match project"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        
        # Check if enquiry already exists
        from applications.models import Application
        if Application.objects.filter(project=project, lender=product.lender).exists():
            return Response(
                {"error": "An enquiry or application already exists for this product"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Create enquiry
        from decimal import Decimal
        # Get term from project or use product default
        proposed_term = project.term_required_months
        if not proposed_term and product.term_min_months:
            # Use product's minimum term if project doesn't specify
            proposed_term = product.term_min_months
        elif not proposed_term:
            # Default to 24 months if neither project nor product specifies
            proposed_term = 24
        
        enquiry = Application.objects.create(
            project=project,
            lender=product.lender,
            product=product,
            initiated_by="borrower",
            proposed_loan_amount=project.loan_amount_required,
            proposed_term_months=proposed_term,
            proposed_ltv_ratio=Decimal(str(project.calculate_ltv_ratio())) if project.calculate_ltv_ratio() else None,
            notes=request.data.get("notes", ""),
            status="submitted",
        )
        
        # Send email notification to lender
        try:
            from notifications.services import EmailNotificationService
            lender_email = product.lender.user.email
            if lender_email:
                EmailNotificationService.notify_application_received(enquiry, lender_email)
        except Exception as e:
            print(f"Failed to send enquiry notification email: {e}")
        
        from applications.serializers import ApplicationSerializer
        serializer = ApplicationSerializer(enquiry, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])  # type: ignore[misc]
    def approve(self, request, pk: str | None = None):
        """
        Admin action to approve a pending project.  Sets the project's status
        to "approved".  Only users with the Admin role or superuser status
        can perform this action.
        """
        project = self.get_object()
        if project.status != "approved":
            project.status = "approved"
            project.save(update_fields=["status"])
            
            # Send email notification
            try:
                from notifications.services import EmailNotificationService
                borrower_email = project.borrower.user.email
                if borrower_email:
                    EmailNotificationService.notify_project_approved(project, borrower_email)
            except Exception as e:
                # Log error but don't fail the request
                print(f"Failed to send approval email: {e}")
        
        serializer = ProjectSerializer(project, context={"request": request})
        return Response(serializer.data)