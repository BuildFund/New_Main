"""Admin configuration for applications app."""

from django.contrib import admin
from .models import Application, ApplicationStatusHistory, ApplicationDocument


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "project",
        "lender",
        "product",
        "proposed_loan_amount",
        "status",
        "status_changed_at",
        "created_at",
    )
    search_fields = (
        "project__description",
        "project__address",
        "lender__organisation_name",
        "product__name",
        "status_feedback",
    )
    list_filter = ("status", "initiated_by", "created_at")
    readonly_fields = ("status_changed_at", "created_at", "updated_at")
    fieldsets = (
        ("Application Details", {
            "fields": ("project", "lender", "product", "initiated_by")
        }),
        ("Proposed Terms", {
            "fields": (
                "proposed_loan_amount",
                "proposed_interest_rate",
                "proposed_term_months",
                "proposed_ltv_ratio",
            )
        }),
        ("Status & Notes", {
            "fields": ("status", "status_feedback", "notes", "status_changed_at")
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )


@admin.register(ApplicationStatusHistory)
class ApplicationStatusHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "application",
        "status",
        "changed_by",
        "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = ("application__id", "status", "feedback")
    readonly_fields = ("created_at",)


@admin.register(ApplicationDocument)
class ApplicationDocumentAdmin(admin.ModelAdmin):
    list_display = ("id", "application", "document", "uploaded_by", "uploaded_at")
    list_filter = ("uploaded_at",)
    search_fields = ("application__id", "document__file_name", "uploaded_by__username")
    readonly_fields = ("uploaded_at",)