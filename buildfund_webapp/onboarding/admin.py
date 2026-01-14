"""Admin configuration for onboarding app."""

from django.contrib import admin
from .models import OnboardingProgress, OnboardingData, OnboardingSession


@admin.register(OnboardingProgress)
class OnboardingProgressAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "is_complete",
        "completion_percentage",
        "current_step",
        "company_verified",
        "address_verified",
        "verification_score",
        "last_updated",
    )
    list_filter = ("is_complete", "company_verified", "address_verified", "last_updated")
    search_fields = ("user__email", "user__username", "current_step")
    readonly_fields = ("started_at", "completed_at", "last_updated")


@admin.register(OnboardingData)
class OnboardingDataAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "first_name",
        "last_name",
        "company_name",
        "postcode",
        "data_collected_via",
        "updated_at",
    )
    list_filter = ("data_collected_via", "country", "updated_at")
    search_fields = (
        "user__email",
        "user__username",
        "first_name",
        "last_name",
        "company_name",
        "company_registration_number",
        "postcode",
    )
    readonly_fields = ("created_at", "updated_at")


@admin.register(OnboardingSession)
class OnboardingSessionAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "session_id",
        "current_step",
        "is_active",
        "started_at",
        "last_activity",
    )
    list_filter = ("is_active", "current_step", "started_at")
    search_fields = ("user__email", "user__username", "session_id")
    readonly_fields = ("session_id", "started_at", "last_activity")
