"""Admin configuration for products app."""

from django.contrib import admin
from .models import Product, FavouriteProduct


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "lender",
        "funding_type",
        "property_type",
        "min_loan_amount",
        "max_loan_amount",
        "status",
    )
    search_fields = ("name", "lender__organisation_name")
    list_filter = ("funding_type", "property_type", "status")


@admin.register(FavouriteProduct)
class FavouriteProductAdmin(admin.ModelAdmin):
    list_display = ("borrower", "product", "project", "created_at")
    search_fields = ("borrower__user__username", "product__name")
    list_filter = ("created_at",)