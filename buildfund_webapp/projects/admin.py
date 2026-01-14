"""Admin configuration for projects app."""

from django.contrib import admin
from .models import Project


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "project_reference",
        "borrower",
        "funding_type",
        "property_type",
        "loan_amount_required",
        "status",
        "created_at",
    )
    search_fields = ("project_reference", "borrower__user__email", "address", "town", "postcode")
    list_filter = ("funding_type", "property_type", "status")
    readonly_fields = ("project_reference",)