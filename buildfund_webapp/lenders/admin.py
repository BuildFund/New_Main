"""Admin configuration for lenders app."""

from django.contrib import admin
from .models import LenderProfile


@admin.register(LenderProfile)
class LenderProfileAdmin(admin.ModelAdmin):
    list_display = (
        "organisation_name",
        "company_number",
        "contact_email",
        "number_of_employees",
    )
    search_fields = ("organisation_name", "company_number", "contact_email")