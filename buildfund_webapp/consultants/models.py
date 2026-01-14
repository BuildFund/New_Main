"""Models for consultant/solicitor profiles and services."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class ConsultantProfile(models.Model):
    """Extends the User model with consultant/solicitor-specific details."""
    
    SERVICE_TYPES = [
        ("monitoring_surveyor", "Monitoring Surveyor"),
        ("valuation", "Valuation"),
        ("solicitor", "Solicitor"),
        ("other", "Other Professional Service"),
    ]
    
    QUALIFICATION_TYPES = [
        ("rics", "RICS (Royal Institution of Chartered Surveyors)"),
        ("rics_monitoring", "RICS Monitoring Surveyor"),
        ("rics_valuation", "RICS Valuer"),
        ("sra", "SRA (Solicitors Regulation Authority)"),
        ("cilex", "CILEX (Chartered Institute of Legal Executives)"),
        ("other", "Other Professional Qualification"),
    ]
    
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    
    # Step 1: Account & Consent fields
    mobile_number = models.CharField(max_length=30, blank=True)
    mfa_enabled = models.BooleanField(default=False)
    consent_privacy = models.BooleanField(default=False)
    consent_terms = models.BooleanField(default=False)
    consent_credit_search = models.BooleanField(default=False)
    
    # Professional Information
    organisation_name = models.CharField(max_length=200, help_text="Firm or company name")
    trading_name = models.CharField(max_length=200, blank=True, help_text="Trading name if different")
    company_registration_number = models.CharField(max_length=50, blank=True)
    
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
    
    # Services Offered
    services_offered = models.JSONField(
        default=list,
        help_text="List of services offered: monitoring_surveyor, valuation, solicitor, other"
    )
    primary_service = models.CharField(
        max_length=30,
        choices=SERVICE_TYPES,
        help_text="Primary service type"
    )
    
    # Qualifications & Compliance
    qualifications = models.JSONField(
        default=list,
        help_text="List of professional qualifications (RICS, SRA, CILEX, etc.)"
    )
    professional_registration_numbers = models.JSONField(
        default=dict,
        blank=True,
        help_text="Professional registration numbers (e.g., RICS number, SRA number)"
    )
    insurance_details = models.JSONField(
        default=dict,
        blank=True,
        help_text="Professional indemnity insurance details"
    )
    compliance_certifications = models.JSONField(
        default=list,
        blank=True,
        help_text="Compliance certifications (ISO, FCA, etc.)"
    )
    
    # Contact Information
    contact_email = models.EmailField(max_length=255)
    contact_phone = models.CharField(max_length=30, blank=True)
    website = models.URLField(blank=True)
    address_line_1 = models.CharField(max_length=255, blank=True)
    address_line_2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    county = models.CharField(max_length=100, blank=True)
    postcode = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=100, default="United Kingdom")
    
    # Geographic Coverage
    geographic_coverage = models.JSONField(
        default=list,
        blank=True,
        help_text="Regions/counties where services are offered"
    )
    
    # Service Details
    service_description = models.TextField(blank=True, help_text="Description of services offered")
    years_of_experience = models.PositiveIntegerField(null=True, blank=True)
    team_size = models.PositiveIntegerField(null=True, blank=True)
    key_personnel = models.JSONField(
        default=list,
        blank=True,
        help_text="Key personnel with qualifications and experience"
    )
    
    # Capacity & Availability
    current_capacity = models.PositiveIntegerField(
        default=10,
        help_text="Current number of active projects"
    )
    max_capacity = models.PositiveIntegerField(
        default=20,
        help_text="Maximum number of concurrent projects"
    )
    average_response_time_days = models.PositiveIntegerField(
        default=3,
        help_text="Average response time in days"
    )
    
    # Documents
    documents = models.ManyToManyField("documents.Document", blank=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False, help_text="Verified by admin")
    verified_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Consultant Profile"
        verbose_name_plural = "Consultant Profiles"
    
    def __str__(self) -> str:
        return f"ConsultantProfile({self.organisation_name})"
    
    def has_capacity(self) -> bool:
        """Check if consultant has capacity for new projects."""
        return self.current_capacity < self.max_capacity


class ConsultantService(models.Model):
    """Represents a specific service request for a consultant on a project."""
    
    SERVICE_TYPES = [
        ("monitoring_surveyor", "Monitoring Surveyor"),
        ("valuation", "Valuation"),
        ("solicitor", "Solicitor"),
    ]
    
    STATUS_CHOICES = [
        ("pending", "Pending - Awaiting Quotes"),
        ("quotes_received", "Quotes Received"),
        ("consultant_selected", "Consultant Selected"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]
    
    application = models.ForeignKey(
        "applications.Application",
        related_name="consultant_services",
        on_delete=models.CASCADE,
        help_text="The loan application requiring this service"
    )
    service_type = models.CharField(max_length=30, choices=SERVICE_TYPES)
    description = models.TextField(blank=True, help_text="Specific requirements for this service")
    required_by_date = models.DateField(null=True, blank=True, help_text="Required completion date")
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="pending")
    
    # Matching Criteria
    required_qualifications = models.JSONField(
        default=list,
        blank=True,
        help_text="Required qualifications (e.g., RICS, SRA)"
    )
    geographic_requirement = models.CharField(
        max_length=100,
        blank=True,
        help_text="Required geographic location"
    )
    minimum_experience_years = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Minimum years of experience required"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Consultant Service"
        verbose_name_plural = "Consultant Services"
        ordering = ["-created_at"]
    
    def __str__(self) -> str:
        return f"ConsultantService({self.get_service_type_display()} for Application {self.application.id})"


class ConsultantQuote(models.Model):
    """Represents a quote submitted by a consultant for a service request."""
    
    STATUS_CHOICES = [
        ("submitted", "Submitted"),
        ("under_review", "Under Review"),
        ("accepted", "Accepted"),
        ("declined", "Declined"),
        ("withdrawn", "Withdrawn"),
    ]
    
    consultant = models.ForeignKey(
        ConsultantProfile,
        related_name="quotes",
        on_delete=models.CASCADE
    )
    service = models.ForeignKey(
        ConsultantService,
        related_name="quotes",
        on_delete=models.CASCADE
    )
    
    # Quote Details
    quote_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        help_text="Total quote amount in GBP"
    )
    quote_breakdown = models.JSONField(
        default=dict,
        blank=True,
        help_text="Breakdown of quote (e.g., fees, expenses, VAT)"
    )
    estimated_completion_date = models.DateField(
        help_text="Estimated date of service completion"
    )
    payment_terms = models.TextField(
        blank=True,
        help_text="Payment terms and schedule"
    )
    
    # Service Details
    service_description = models.TextField(
        blank=True,
        help_text="Detailed description of services to be provided"
    )
    deliverables = models.JSONField(
        default=list,
        blank=True,
        help_text="List of deliverables"
    )
    timeline = models.TextField(
        blank=True,
        help_text="Proposed timeline for service delivery"
    )
    
    # Terms & Conditions
    terms_and_conditions = models.TextField(
        blank=True,
        help_text="Terms and conditions of the quote"
    )
    validity_period_days = models.PositiveIntegerField(
        default=30,
        help_text="Quote validity period in days"
    )
    
    # Status
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="submitted")
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    
    # Notes
    notes = models.TextField(blank=True, help_text="Internal notes or comments")
    
    class Meta:
        verbose_name = "Consultant Quote"
        verbose_name_plural = "Consultant Quotes"
        ordering = ["-submitted_at"]
        unique_together = ("consultant", "service")
    
    def __str__(self) -> str:
        return f"Quote({self.consultant.organisation_name} - £{self.quote_amount})"
    
    def is_valid(self) -> bool:
        """Check if quote is still valid."""
        if self.status != "submitted":
            return False
        expiry_date = self.submitted_at.date() + timezone.timedelta(days=self.validity_period_days)
        return timezone.now().date() <= expiry_date


class ConsultantAppointment(models.Model):
    """Represents an appointment of a consultant to a service request."""
    
    STATUS_CHOICES = [
        ("appointed", "Appointed"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("terminated", "Terminated"),
    ]
    
    consultant = models.ForeignKey(
        ConsultantProfile,
        related_name="appointments",
        on_delete=models.CASCADE
    )
    service = models.OneToOneField(
        ConsultantService,
        related_name="appointment",
        on_delete=models.CASCADE
    )
    quote = models.OneToOneField(
        ConsultantQuote,
        related_name="appointment",
        on_delete=models.CASCADE,
        help_text="The quote that was accepted"
    )
    
    # Appointment Details
    appointment_date = models.DateTimeField(
        auto_now_add=True,
        help_text="Date when consultant was appointed"
    )
    start_date = models.DateField(
        null=True,
        blank=True,
        help_text="Actual start date of service"
    )
    expected_completion_date = models.DateField(
        null=True,
        blank=True,
        help_text="Expected completion date"
    )
    actual_completion_date = models.DateField(
        null=True,
        blank=True,
        help_text="Actual completion date"
    )
    
    # Status
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="appointed")
    
    # Documents & Files
    documents = models.ManyToManyField(
        "documents.Document",
        blank=True,
        related_name="consultant_appointments",
        help_text="Documents uploaded by consultant"
    )
    
    # Notes & Updates
    progress_notes = models.JSONField(
        default=list,
        blank=True,
        help_text="Progress notes and updates from consultant"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Consultant Appointment"
        verbose_name_plural = "Consultant Appointments"
        ordering = ["-appointment_date"]
    
    def __str__(self) -> str:
        return f"Appointment({self.consultant.organisation_name} - {self.service.get_service_type_display()})"
