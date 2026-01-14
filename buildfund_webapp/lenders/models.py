"""Models for the lenders app."""
from __future__ import annotations

from django.conf import settings
from django.db import models


class LenderProfile(models.Model):
    """Extends the User model with lender‑specific details."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    organisation_name = models.CharField(max_length=100)
    company_number = models.CharField(max_length=50, blank=True)
    fca_registration_number = models.CharField(max_length=50, blank=True)
    contact_email = models.EmailField(max_length=255)
    contact_phone = models.CharField(max_length=30, blank=True)
    website = models.URLField(blank=True)
    company_story = models.TextField(blank=True)
    number_of_employees = models.PositiveIntegerField(null=True, blank=True)
    financial_licences = models.CharField(max_length=255, blank=True)
    membership_bodies = models.CharField(max_length=255, blank=True)
    key_personnel = models.JSONField(default=list, blank=True)
    risk_compliance_details = models.JSONField(default=dict, blank=True)
    documents = models.ManyToManyField("documents.Document", blank=True)
    
    # Step 1: Account & Consent fields
    mobile_number = models.CharField(max_length=30, blank=True)
    mfa_enabled = models.BooleanField(default=False)
    consent_privacy = models.BooleanField(default=False)
    consent_terms = models.BooleanField(default=False)
    consent_credit_search = models.BooleanField(default=False)
    
    # Step 2: Company verification fields
    company_data = models.JSONField(default=dict, blank=True, help_text="Full company data from Companies House")
    company_verified_at = models.DateTimeField(null=True, blank=True)
    trading_address = models.TextField(blank=True)
    
    # Step 3: Directors and shareholders
    directors_data = models.JSONField(default=list, blank=True, help_text="Directors from Companies House")
    shareholders_data = models.JSONField(default=list, blank=True, help_text="Shareholders/PSCs from Companies House")
    account_holder_is_director = models.BooleanField(default=False)
    account_holder_name = models.CharField(max_length=255, blank=True)
    account_holder_role = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:  # pragma: no cover
        return f"LenderProfile({self.organisation_name})"