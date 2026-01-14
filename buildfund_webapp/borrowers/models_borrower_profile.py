"""Enhanced Borrower Profile models for the new wizard-based onboarding."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class BorrowerConsent(models.Model):
    """Tracks borrower consents with versioning."""
    
    CONSENT_TYPES = [
        ('privacy_policy', 'Privacy Policy'),
        ('terms_of_service', 'Terms of Service'),
        ('credit_search', 'Credit Search Permission'),
        ('data_sharing', 'Data Sharing with Lenders'),
        ('marketing', 'Marketing Communications'),
    ]
    
    borrower = models.ForeignKey(
        'borrowers.BorrowerProfile',
        on_delete=models.CASCADE,
        related_name='profile_consents'
    )
    consent_type = models.CharField(max_length=50, choices=CONSENT_TYPES)
    version = models.CharField(max_length=20, help_text="Version of the consent document")
    given = models.BooleanField(default=False)
    given_at = models.DateTimeField(null=True, blank=True)
    withdrawn_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    class Meta:
        unique_together = ('borrower', 'consent_type', 'version')
        ordering = ['-given_at']
    
    def __str__(self):
        return f"{self.borrower.user.email} - {self.get_consent_type_display()} ({self.version})"


class CompanyData(models.Model):
    """Stores Companies House API data for borrower's company."""
    
    borrower = models.OneToOneField(
        'borrowers.BorrowerProfile',
        on_delete=models.CASCADE,
        related_name='company_data'
    )
    
    # Companies House data (imported, unconfirmed)
    company_number = models.CharField(max_length=20, unique=True)
    company_name = models.CharField(max_length=255)
    company_name_original = models.CharField(max_length=255, blank=True)  # Original from CH
    company_status = models.CharField(max_length=50, blank=True)  # Active, Dissolved, etc.
    incorporation_date = models.DateField(null=True, blank=True)
    company_type = models.CharField(max_length=50, blank=True)  # ltd, plc, llp, etc.
    sic_codes = models.JSONField(default=list, blank=True)  # List of SIC codes
    registered_address = models.JSONField(default=dict, blank=True)  # Full address from CH
    
    # Manual overrides (borrower confirmed/updated)
    trading_address = models.JSONField(default=dict, blank=True)  # May differ from registered
    primary_contact_email = models.EmailField(blank=True)
    primary_contact_phone = models.CharField(max_length=30, blank=True)
    
    # Verification status
    is_confirmed = models.BooleanField(default=False, help_text="Borrower has confirmed the data")
    confirmed_at = models.DateTimeField(null=True, blank=True)
    is_verified_via_companies_house = models.BooleanField(default=False)  # Visual indicator
    verified_via_companies_house_at = models.DateTimeField(null=True, blank=True)
    companies_house_data = models.JSONField(default=dict, blank=True)  # Full API response
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
        return f"Company({self.company_name} - {self.company_number})"


class CompanyPerson(models.Model):
    """Stores directors, shareholders, and PSC from Companies House."""
    
    ROLE_CHOICES = [
        ('director', 'Director'),
        ('shareholder', 'Shareholder'),
        ('psc', 'Person with Significant Control'),
        ('applicant', 'Applicant (Required)'),
    ]
    
    company = models.ForeignKey(
        CompanyData,
        on_delete=models.CASCADE,
        related_name='persons'
    )
    
    # Companies House data
    person_id = models.CharField(max_length=100, blank=True)  # CH person ID
    name = models.CharField(max_length=255)
    date_of_birth = models.DateField(null=True, blank=True)
    nationality = models.CharField(max_length=100, blank=True)
    address = models.JSONField(default=dict, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    ownership_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Ownership percentage (0-100)"
    )
    
    # Borrower confirmation
    is_confirmed = models.BooleanField(default=False)
    is_applicant_required = models.BooleanField(
        default=False,
        help_text="Automatically flagged if director or >=25% ownership"
    )
    is_deselected = models.BooleanField(
        default=False,
        help_text="Borrower deselected this person"
    )
    deselection_reason = models.TextField(
        blank=True,
        help_text="Reason for deselection (requires admin review)"
    )
    
    companies_house_data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('company', 'name', 'role')  # Use name instead of person_id for uniqueness
    
    def __str__(self):
        return f"{self.name} - {self.get_role_display()} ({self.company.company_name})"


class ApplicantPersonalDetails(models.Model):
    """Personal details for applicants (directors and >=25% shareholders)."""
    
    company_person = models.OneToOneField(
        CompanyPerson,
        on_delete=models.CASCADE,
        related_name='personal_details'
    )
    borrower = models.ForeignKey(
        'borrowers.BorrowerProfile',
        on_delete=models.CASCADE,
        related_name='applicants'
    )
    
    # Personal Information
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    date_of_birth = models.DateField()
    nationality = models.CharField(max_length=100)
    
    # Contact Details
    email = models.EmailField()
    phone = models.CharField(max_length=30)
    mobile = models.CharField(max_length=30, blank=True)
    
    # Address History
    current_address = models.JSONField(default=dict)
    current_address_start_date = models.DateField()
    previous_address = models.JSONField(default=dict, blank=True, null=True)
    previous_address_start_date = models.DateField(null=True, blank=True)
    previous_address_end_date = models.DateField(null=True, blank=True)
    
    # Employment
    employment_status = models.CharField(max_length=50)  # Employed, Self-employed, etc.
    occupation = models.CharField(max_length=200, blank=True)
    employment_start_date = models.DateField(null=True, blank=True)
    net_monthly_income = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    
    # Underwriting Flags
    borrower_experience_tier = models.CharField(
        max_length=20,
        choices=[
            ('0', '0 deals'),
            ('1-3', '1-3 deals'),
            ('4-10', '4-10 deals'),
            ('10+', '10+ deals'),
        ],
        blank=True
    )
    adverse_credit_band = models.CharField(
        max_length=20,
        choices=[
            ('none', 'None'),
            ('minor', 'Minor'),
            ('significant', 'Significant'),
        ],
        blank=True
    )
    source_of_deposit = models.CharField(max_length=100, blank=True)
    intended_exit_strategy = models.CharField(max_length=100, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} - {self.borrower.user.email}"


class ApplicantFinancialSnapshot(models.Model):
    """Financial snapshot for applicants (quick or detailed mode)."""
    
    applicant = models.OneToOneField(
        ApplicantPersonalDetails,
        on_delete=models.CASCADE,
        related_name='financial_snapshot'
    )
    
    # Mode selection
    mode = models.CharField(
        max_length=20,
        choices=[
            ('quick', 'Quick Mode (Totals Only)'),
            ('detailed', 'Detailed Mode (Line Items)'),
        ],
        default='quick'
    )
    
    # Quick Mode Totals
    total_income = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    total_expenditure = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    total_assets = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    total_liabilities = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    
    # Detailed Mode Data (JSON)
    income_breakdown = models.JSONField(default=list, blank=True)
    expenditure_breakdown = models.JSONField(default=list, blank=True)
    assets_breakdown = models.JSONField(default=list, blank=True)
    liabilities_breakdown = models.JSONField(default=list, blank=True)
    
    data_source = models.CharField(
        max_length=50,
        choices=[
            ('manual', 'Manual Entry'),
            ('open_banking', 'Open Banking'),
            ('pdf_upload', 'PDF Upload'),
        ],
        default='manual'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Financial Snapshot - {self.applicant.first_name} {self.applicant.last_name}"


class OpenBankingConnection(models.Model):
    """Stores Open Banking connection data (no credentials)."""
    
    borrower = models.ForeignKey(
        'borrowers.BorrowerProfile',
        on_delete=models.CASCADE,
        related_name='open_banking_connections'
    )
    
    provider = models.CharField(max_length=100)  # Bank name/provider (e.g., 'open_bank_project')
    provider_reference = models.CharField(max_length=255, unique=True)  # Provider's reference (oauth_token)
    
    # OAuth 1.0a tokens (encrypt in production)
    oauth_token = models.CharField(max_length=255, blank=True)  # OAuth access token
    oauth_token_secret = models.CharField(max_length=255, blank=True)  # OAuth access token secret
    
    account_ids = models.JSONField(default=list)  # List of connected account IDs
    account_balances = models.JSONField(default=dict)  # Current balances per account
    transaction_summaries = models.JSONField(default=dict)  # Transaction summaries
    
    consent_timestamp = models.DateTimeField()
    last_sync_date = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    # Account types
    has_business_accounts = models.BooleanField(default=False)
    has_personal_accounts = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-last_sync_date']
    
    def __str__(self):
        return f"Open Banking - {self.provider} ({self.borrower.user.email})"


class BorrowerProfileReview(models.Model):
    """Tracks admin review workflow for borrower profiles."""
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('ready_for_review', 'Ready for Review'),
        ('under_review', 'Under Review'),
        ('changes_requested', 'Changes Requested'),
        ('approved', 'Approved'),
    ]
    
    borrower = models.OneToOneField(
        'borrowers.BorrowerProfile',
        on_delete=models.CASCADE,
        related_name='review'
    )
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_borrower_profiles'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    # Admin notes (not visible to borrower)
    internal_notes = models.TextField(blank=True)
    
    # Change requests
    change_requests = models.JSONField(
        default=list,
        blank=True,
        help_text="List of requested changes with step references"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-submitted_at']
    
    def __str__(self):
        return f"Review({self.borrower.user.email} - {self.status})"


class StepUpAuthentication(models.Model):
    """Tracks step-up authentication sessions."""
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='step_up_sessions'
    )
    
    session_key = models.CharField(max_length=100, unique=True)
    authenticated_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    purpose = models.CharField(
        max_length=50,
        choices=[
            ('profile_access', 'Profile/Documents Access'),
            ('bank_data', 'Bank Data Access'),
            ('document_download', 'Document Download'),
        ]
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    class Meta:
        ordering = ['-authenticated_at']
        indexes = [
            models.Index(fields=['user', 'expires_at']),
        ]
    
    def is_valid(self):
        """Check if step-up authentication is still valid."""
        return timezone.now() < self.expires_at
    
    def __str__(self):
        return f"StepUp({self.user.email} - {self.purpose})"
