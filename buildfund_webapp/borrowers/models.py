"""Models related to borrower profiles."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class BorrowerProfile(models.Model):
    """Extends the User model with borrower‑specific details."""

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('ready_for_review', 'Ready for Review'),
        ('under_review', 'Under Review'),
        ('changes_requested', 'Changes Requested'),
        ('approved', 'Approved'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    
    # Status and workflow
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_borrower_profiles'
    )
    admin_notes = models.TextField(blank=True, help_text="Internal notes not visible to borrower")
    changes_requested = models.JSONField(default=list, blank=True, help_text="List of requested changes")
    
    # Step 1: Account setup and consent
    mobile_number = models.CharField(max_length=30, blank=True)
    mfa_enabled = models.BooleanField(default=False)
    consent_privacy = models.BooleanField(default=False)
    consent_privacy_version = models.CharField(max_length=50, blank=True)
    consent_privacy_timestamp = models.DateTimeField(null=True, blank=True)
    consent_terms = models.BooleanField(default=False)
    consent_terms_version = models.CharField(max_length=50, blank=True)
    consent_terms_timestamp = models.DateTimeField(null=True, blank=True)
    consent_credit_search = models.BooleanField(default=False)
    consent_credit_search_timestamp = models.DateTimeField(null=True, blank=True)
    
    # Legacy fields (kept for backward compatibility)
    first_name = models.CharField(max_length=50, blank=True)
    last_name = models.CharField(max_length=50, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    company_name = models.CharField(max_length=100, blank=True)
    registration_number = models.CharField(max_length=50, blank=True)
    trading_name = models.CharField(max_length=100, blank=True)
    phone_number = models.CharField(max_length=30, blank=True)
    address_1 = models.CharField(max_length=255, blank=True)
    address_2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    county = models.CharField(max_length=100, blank=True)
    postcode = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=100, blank=True)
    experience_description = models.TextField(blank=True)
    income_details = models.JSONField(default=dict, blank=True)
    expenses_details = models.JSONField(default=dict, blank=True)
    
    # Step 2: Company verification
    company_data = models.JSONField(default=dict, blank=True, help_text="Full Companies House data including charges summary")
    company_verified_at = models.DateTimeField(null=True, blank=True)
    charges_summary = models.JSONField(default=dict, blank=True, help_text="Summary of company charges (mortgages, debentures)")
    trading_address = models.TextField(blank=True)
    primary_contact_email = models.EmailField(blank=True)
    primary_contact_phone = models.CharField(max_length=30, blank=True)
    
    # Step 3: Directors and shareholders
    directors_data = models.JSONField(default=list, blank=True)
    shareholders_data = models.JSONField(default=list, blank=True)
    applicants_required = models.JSONField(default=list, blank=True)
    
    # Step 4: Applicant personal details
    applicants_data = models.JSONField(default=list, blank=True, help_text="Array of applicant objects")
    
    # Step 5: Financial snapshot
    financial_mode = models.CharField(max_length=20, choices=[('quick', 'Quick'), ('detailed', 'Detailed')], default='quick')
    financial_data = models.JSONField(default=dict, blank=True)
    
    # Step 6: Bank data
    bank_data_method = models.CharField(max_length=20, choices=[('open_banking', 'Open Banking'), ('pdf_upload', 'PDF Upload')], blank=True)
    open_banking_connected = models.BooleanField(default=False)
    open_banking_provider = models.CharField(max_length=100, blank=True)
    open_banking_consent_timestamp = models.DateTimeField(null=True, blank=True)
    open_banking_last_sync = models.DateTimeField(null=True, blank=True)
    open_banking_accounts = models.JSONField(default=list, blank=True)
    bank_statements = models.JSONField(default=list, blank=True)
    
    # Step 7: Documents (stored as JSON with metadata)
    company_documents = models.JSONField(default=dict, blank=True)
    personal_documents = models.JSONField(default=dict, blank=True)
    
    documents = models.ManyToManyField("documents.Document", blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:  # pragma: no cover
        return f"BorrowerProfile({self.user.email})"
    
    def can_edit(self):
        """Check if profile can be edited (not locked for review)."""
        return self.status in ['draft', 'changes_requested']
    
    def is_approved(self):
        """Check if profile is approved."""
        return self.status == 'approved'