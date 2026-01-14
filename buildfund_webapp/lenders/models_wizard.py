"""Wizard-related models for Lender profiles."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class LenderCompanyData(models.Model):
    """Stores Companies House API data for lender's company."""
    
    lender = models.OneToOneField(
        'lenders.LenderProfile',
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
        return f"LenderCompany({self.company_name} - {self.company_number})"


class LenderCompanyPerson(models.Model):
    """Stores directors and key personnel from Companies House."""
    
    ROLE_CHOICES = [
        ('director', 'Director'),
        ('shareholder', 'Shareholder'),
        ('key_personnel', 'Key Personnel'),
    ]
    
    company = models.ForeignKey(
        LenderCompanyData,
        on_delete=models.CASCADE,
        related_name='persons'
    )
    
    person_id = models.CharField(max_length=100, blank=True)
    name = models.CharField(max_length=255)
    date_of_birth = models.DateField(null=True, blank=True)
    nationality = models.CharField(max_length=100, blank=True)
    address = models.JSONField(default=dict, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    ownership_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    # Additional fields for key personnel
    job_title = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    
    is_confirmed = models.BooleanField(default=False)
    companies_house_data = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('company', 'name', 'role')  # Use name instead of person_id for uniqueness
    
    def __str__(self):
        return f"{self.name} - {self.get_role_display()} ({self.company.company_name})"
