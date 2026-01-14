"""Admin configuration for funding requests."""
from django.contrib import admin
from .models import FundingRequest


@admin.register(FundingRequest)
class FundingRequestAdmin(admin.ModelAdmin):
    list_display = ["request_reference", "borrower", "funding_type", "amount_required", "status", "created_at"]
    list_filter = ["funding_type", "status", "created_at"]
    search_fields = ["request_reference", "borrower__user__email", "purpose", "description"]
