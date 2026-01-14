"""Admin configuration for private equity module."""

from django.contrib import admin
from .models import PrivateEquityOpportunity, PrivateEquityInvestment
from .certification_models import FCASelfCertification


@admin.register(PrivateEquityOpportunity)
class PrivateEquityOpportunityAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "borrower", "funding_required", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("title", "description", "borrower__user__email")
    readonly_fields = ("created_at", "updated_at")


@admin.register(PrivateEquityInvestment)
class PrivateEquityInvestmentAdmin(admin.ModelAdmin):
    list_display = ("id", "opportunity", "lender", "amount", "share", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("opportunity__title", "lender__organisation_name")
    readonly_fields = ("created_at", "updated_at")


@admin.register(FCASelfCertification)
class FCASelfCertificationAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "certification_type",
        "is_active",
        "is_valid",
        "certified_at",
        "ip_address",
    )
    list_filter = ("certification_type", "is_active", "certified_at")
    search_fields = ("user__email", "user__username", "ip_address")
    readonly_fields = (
        "certified_at",
        "last_updated",
        "ip_address",
        "user_agent",
    )
    fieldsets = (
        ("User Information", {"fields": ("user", "is_active")}),
        ("Certification Details", {
            "fields": (
                "certification_type",
                "is_high_net_worth",
                "is_sophisticated",
            )
        }),
        ("Required Declarations", {
            "fields": (
                "understands_risks",
                "understands_illiquidity",
                "can_afford_loss",
                "has_received_advice",
            )
        }),
        ("Additional Information", {
            "fields": (
                "annual_income",
                "net_assets",
                "investment_experience_years",
            ),
            "classes": ("collapse",),
        }),
        ("Compliance", {
            "fields": (
                "ip_address",
                "user_agent",
                "certified_at",
                "last_updated",
            ),
            "classes": ("collapse",),
        }),
        ("Admin Notes", {"fields": ("admin_notes",)}),
    )
