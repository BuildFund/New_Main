"""Admin configuration for underwriting app."""

from django.contrib import admin
from .models import UnderwritingReport


@admin.register(UnderwritingReport)
class UnderwritingReportAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "project",
        "report_type",
        "created_at",
    )
    search_fields = ("project__description", "report_type")
    list_filter = ("report_type",)