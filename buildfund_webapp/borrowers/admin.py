"""Admin configuration for borrowers app."""

from django.contrib import admin
from .models import BorrowerProfile


@admin.register(BorrowerProfile)
class BorrowerProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "company_name", "registration_number")
    search_fields = (
        "user__email",
        "company_name",
        "registration_number",
        "last_name",
    )