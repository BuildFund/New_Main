"""Views for product management."""
from __future__ import annotations

from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action  # type: ignore
from rest_framework.response import Response

from accounts.permissions import IsAdmin, IsLender

from .models import Product, FavouriteProduct
from .serializers import ProductSerializer, FavouriteProductSerializer




class ProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet for creating, listing and retrieving products.  Lenders can
    manage their own products, whilst general authenticated users see only
    active products.  Additional actions allow administrators to approve
    pending products.
    """

    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Determine the queryset based on the requesting user's role.

        - Lenders see only their own products.
        - Administrators see all products regardless of status.
        - Other authenticated users see only active products.
        """
        user = self.request.user
        # Lender: only own products
        if hasattr(user, "lenderprofile"):
            return Product.objects.filter(lender=user.lenderprofile)
        # Admin: all products
        if IsAdmin().has_permission(self.request, self):
            return Product.objects.all()
        # Others: active only
        return Product.objects.filter(status="active")

    def get_permissions(self):
        """Assign custom permissions based on action."""
        if self.action in {"create", "update", "partial_update", "destroy"}:
            permission_classes = [permissions.IsAuthenticated, IsLender]
        elif self.action == "approve":
            # Only admins can approve products
            permission_classes = [permissions.IsAuthenticated, IsAdmin]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [perm() for perm in permission_classes]



    @action(detail=True, methods=["post"])  # type: ignore[misc]
    def approve(self, request, pk: str | None = None):
        """
        Admin action to approve a pending product.  Sets the product's
        status to "active".  Requires the requesting user to be an
        administrator or superuser.
        """
        product = self.get_object()
        if product.status != "active":
            product.status = "active"
            product.save(update_fields=["status"])
            
            # Send email notification
            try:
                from notifications.services import EmailNotificationService
                lender_email = product.lender.user.email
                if lender_email:
                    EmailNotificationService.notify_product_approved(product, lender_email)
            except Exception as e:
                # Log error but don't fail the request
                print(f"Failed to send approval email: {e}")
        
        serializer = self.get_serializer(product)
        return Response(serializer.data)
    
    @action(detail=True, methods=["get"])
    def lender_details(self, request, pk=None):
        """Get lender details for a product."""
        product = self.get_object()
        lender = product.lender
        return Response({
            "id": lender.id,
            "organisation_name": lender.organisation_name,
            "contact_email": lender.contact_email,
            "contact_phone": lender.contact_phone,
            "website": getattr(lender, "website", ""),
            "description": getattr(lender, "description", ""),
        })


class FavouriteProductViewSet(viewsets.ModelViewSet):
    """ViewSet for managing favourite products."""
    
    serializer_class = FavouriteProductSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return favourite products for the current borrower."""
        user = self.request.user
        if hasattr(user, "borrowerprofile"):
            qs = FavouriteProduct.objects.filter(borrower=user.borrowerprofile).select_related(
                "product", "product__lender", "project"
            )
            # Filter by project if project_id is provided
            project_id = self.request.query_params.get("project_id")
            if project_id:
                qs = qs.filter(project_id=project_id)
            return qs
        return FavouriteProduct.objects.none()
    
    def perform_create(self, serializer):
        """Set the borrower when creating a favourite."""
        if not hasattr(self.request.user, "borrowerprofile"):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only borrowers can favourite products.")
        serializer.save(borrower=self.request.user.borrowerprofile)
    
    @action(detail=False, methods=["post"])
    def toggle(self, request):
        """Toggle favourite status for a product."""
        if not hasattr(request.user, "borrowerprofile"):
            return Response(
                {"error": "Only borrowers can favourite products."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        product_id = request.data.get("product_id")
        project_id = request.data.get("project_id")
        
        if not product_id:
            return Response(
                {"error": "product_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response(
                {"error": "Product not found."},
                status=status.HTTP_404_NOT_FOUND
            )
        
        borrower = request.user.borrowerprofile
        project = None
        if project_id:
            from projects.models import Project
            try:
                project = Project.objects.get(id=project_id, borrower=borrower)
            except Project.DoesNotExist:
                return Response(
                    {"error": "Project not found or not owned by borrower."},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Check if already favourited
        favourite, created = FavouriteProduct.objects.get_or_create(
            borrower=borrower,
            product=product,
            project=project,
            defaults={"notes": request.data.get("notes", "")}
        )
        
        if not created:
            # Already favourited, remove it
            favourite.delete()
            return Response({"favourited": False, "message": "Product removed from favourites"})
        
        return Response({
            "favourited": True,
            "message": "Product added to favourites",
            "favourite": FavouriteProductSerializer(favourite, context={"request": request}).data
        })
    
    @action(detail=False, methods=["get"])
    def check(self, request):
        """Check if a product is favourited."""
        if not hasattr(request.user, "borrowerprofile"):
            return Response({"favourited": False})
        
        product_id = request.query_params.get("product_id")
        project_id = request.query_params.get("project_id")
        
        if not product_id:
            return Response({"favourited": False})
        
        borrower = request.user.borrowerprofile
        exists = FavouriteProduct.objects.filter(
            borrower=borrower,
            product_id=product_id,
            project_id=project_id if project_id else None
        ).exists()
        
        return Response({"favourited": exists})