"""Wizard-related models for Consultant/Solicitor profiles."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class ConsultantCompanyData(models.Model):
    """Stores Companies House API data for consultant's company."""
    
    consultant = models.OneToOneField(
        'consultants.ConsultantProfile',
        on_delete=models.CASCADE,
        related_name='company_data'
    )
    
    # Companies House data (imported, unconfirmed)
    company_number = models.CharField(max_length=20, unique=True)
    company_name = models.CharField(max_length=255)
    company_name_original = models.CharField(max_length=255, blank=True)
    company_status = models.CharField(max_length=50, blank=True)
    incorporation_date = models.DateField(null=True, blank=True)
    company_type = models.CharField(max_length=50, blank=True)
    sic_codes = models.JSONField(default=list, blank=True)
    registered_address = models.JSONField(default=dict, blank=True)
    
    # Manual overrides
    trading_address = models.JSONField(default=dict, blank=True)
    primary_contact_email = models.EmailField(blank=True)
    primary_contact_phone = models.CharField(max_length=30, blank=True)
    
    # Verification status
    is_confirmed = models.BooleanField(default=False)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    is_verified_via_companies_house = models.BooleanField(default=False)  # Visual indicator
    verified_via_companies_house_at = models.DateTimeField(null=True, blank=True)
    companies_house_data = models.JSONField(default=dict, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    
    # Document metadata (for downloaded documents)
    accounts_metadata = models.JSONField(default=list, blank=True)  # List of account filing metadata
    confirmation_statements_metadata = models.JSONField(default=list, blank=True)  # List of statement metadata
    incorporation_certificate_metadata = models.JSONField(default=dict, blank=True)  # Certificate of incorporation metadata
    charges_metadata = models.JSONField(default=list, blank=True)  # List of charge filings metadata
    selected_documents = models.JSONField(default=list, blank=True)  # List of selected document transaction_ids
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"ConsultantCompany({self.company_name} - {self.company_number})"
