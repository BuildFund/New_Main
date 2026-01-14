"""Admin configuration for consultants app."""
from django.contrib import admin
from .models import ConsultantProfile, ConsultantService, ConsultantQuote, ConsultantAppointment


@admin.register(ConsultantProfile)
class ConsultantProfileAdmin(admin.ModelAdmin):
    list_display = ["organisation_name", "primary_service", "is_verified", "is_active", "created_at"]
    list_filter = ["primary_service", "is_verified", "is_active", "created_at"]
    search_fields = ["organisation_name", "user__email", "contact_email"]
    readonly_fields = ["created_at", "updated_at", "verified_at"]


@admin.register(ConsultantService)
class ConsultantServiceAdmin(admin.ModelAdmin):
    list_display = ["service_type", "application", "status", "required_by_date", "created_at"]
    list_filter = ["service_type", "status", "created_at"]
    search_fields = ["application__project__description", "description"]


@admin.register(ConsultantQuote)
class ConsultantQuoteAdmin(admin.ModelAdmin):
    list_display = ["consultant", "service", "quote_amount", "status", "submitted_at"]
    list_filter = ["status", "submitted_at"]
    search_fields = ["consultant__organisation_name", "service__application__project__description"]


@admin.register(ConsultantAppointment)
class ConsultantAppointmentAdmin(admin.ModelAdmin):
    list_display = ["consultant", "service", "status", "appointment_date", "expected_completion_date"]
    list_filter = ["status", "appointment_date"]
    search_fields = ["consultant__organisation_name", "service__application__project__description"]
