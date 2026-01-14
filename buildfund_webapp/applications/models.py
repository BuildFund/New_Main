"""Model definitions for funding applications."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class Application(models.Model):
    """Represents a lender's offer on a project, or a borrower's enquiry about a product."""

    STATUS_CHOICES = [
        ("submitted", "Submitted"),
        ("opened", "Opened"),
        ("under_review", "Under Review"),
        ("further_info_required", "Further Information Required"),
        ("credit_check", "Credit Check/Underwriting"),
        ("approved", "Approved"),
        ("accepted", "Accepted"),
        ("declined", "Declined"),
        ("withdrawn", "Withdrawn"),
        ("completed", "Completed"),
    ]
    
    INITIATED_BY_CHOICES = [
        ("borrower", "Borrower"),
        ("lender", "Lender"),
    ]

    project = models.ForeignKey(
        "projects.Project", related_name="applications", on_delete=models.CASCADE
    )
    lender = models.ForeignKey(
        "lenders.LenderProfile", related_name="applications", on_delete=models.CASCADE
    )
    product = models.ForeignKey(
        "products.Product", related_name="applications", on_delete=models.CASCADE
    )
    # Track who initiated the application/enquiry
    initiated_by = models.CharField(
        max_length=20, 
        choices=INITIATED_BY_CHOICES, 
        default="lender",
        help_text="Whether this application was initiated by the borrower (enquiry) or lender (offer)"
    )
    proposed_loan_amount = models.DecimalField(max_digits=15, decimal_places=2)
    proposed_interest_rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    proposed_term_months = models.PositiveIntegerField()
    proposed_ltv_ratio = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="submitted")
    status_feedback = models.TextField(
        blank=True,
        help_text="Feedback or notes about the current status (e.g., reason for decline, information required)"
    )
    # Borrower consent to share information
    borrower_consent_given = models.BooleanField(
        default=False,
        help_text="Whether borrower has given consent to share their information with the lender"
    )
    borrower_consent_given_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When borrower gave consent"
    )
    borrower_consent_withdrawn_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When borrower withdrew consent (if applicable)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status_changed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("project", "lender")
        ordering = ["-created_at"]

    def update_status(self, new_status, feedback=""):
        """Update application status and record change timestamp."""
        old_status = self.status
        if self.status != new_status:
            self.status = new_status
            self.status_feedback = feedback
            self.status_changed_at = timezone.now()
            self.save(update_fields=["status", "status_feedback", "status_changed_at", "updated_at"])
            
            # Generate underwriter report if status changed to "submitted"
            if old_status != 'submitted' and new_status == 'submitted':
                try:
                    from .underwriter_service import UnderwriterReportService
                    service = UnderwriterReportService()
                    service.generate_report(self, created_by=None)  # System-generated
                except Exception as e:
                    # Log error but don't fail the status update
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Failed to generate underwriter report on submission: {e}", exc_info=True)
            
            # Create Deal if status changed to "accepted"
            if old_status != 'accepted' and new_status == 'accepted':
                try:
                    from deals.services import DealService
                    deal = DealService.create_deal_from_application(self)
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.info(f"Deal {deal.deal_id} created from application {self.id}")
                except Exception as e:
                    # Log error but don't fail the status update
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Failed to create deal on application acceptance: {e}", exc_info=True)

    def __str__(self) -> str:  # pragma: no cover
        return f"Application({self.project.id}→{self.lender.organisation_name})"


class ApplicationStatusHistory(models.Model):
    """Tracks the history of status changes for an application."""
    
    application = models.ForeignKey(
        Application,
        related_name="status_history",
        on_delete=models.CASCADE
    )
    status = models.CharField(max_length=30, choices=Application.STATUS_CHOICES)
    feedback = models.TextField(blank=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="User who made this status change"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Application Status Histories"

    def __str__(self) -> str:
        return f"{self.application.id} - {self.status} ({self.created_at})"


class ApplicationDocument(models.Model):
    """Links documents to applications for shared document access between borrower and lender."""
    
    application = models.ForeignKey(
        Application,
        related_name="documents",
        on_delete=models.CASCADE
    )
    document = models.ForeignKey(
        "documents.Document",
        on_delete=models.CASCADE
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        help_text="User who uploaded this document to the application"
    )
    description = models.CharField(
        max_length=255,
        blank=True,
        help_text="Optional description of the document"
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_required = models.BooleanField(
        default=False,
        help_text="Whether this document is required for the application"
    )
    
    class Meta:
        ordering = ["-uploaded_at"]
        unique_together = ("application", "document")
    
    def __str__(self) -> str:
        return f"ApplicationDocument({self.application.id} - {self.document.file_name})"


class ApplicationUnderwriting(models.Model):
    """Stores AI underwriting assessment results for an application."""
    
    application = models.OneToOneField(
        Application,
        related_name="underwriting",
        on_delete=models.CASCADE
    )
    
    # Overall assessment
    risk_score = models.IntegerField(
        null=True,
        blank=True,
        help_text="Overall risk score (0-100, lower is better)"
    )
    recommendation = models.CharField(
        max_length=50,
        choices=[
            ("approve", "Approve"),
            ("approve_with_conditions", "Approve with Conditions"),
            ("refer", "Refer for Manual Review"),
            ("decline", "Decline"),
        ],
        blank=True
    )
    
    # Assessment details
    assessment_summary = models.TextField(
        blank=True,
        help_text="Summary of AI assessment"
    )
    key_findings = models.JSONField(
        default=list,
        blank=True,
        help_text="List of key findings from document analysis"
    )
    strengths = models.JSONField(
        default=list,
        blank=True,
        help_text="List of application strengths"
    )
    concerns = models.JSONField(
        default=list,
        blank=True,
        help_text="List of concerns or risk factors"
    )
    recommendations = models.TextField(
        blank=True,
        help_text="Recommendations for lender"
    )
    
    # Document analysis
    documents_analyzed = models.IntegerField(default=0)
    documents_valid = models.IntegerField(default=0)
    documents_invalid = models.IntegerField(default=0)
    documents_pending = models.IntegerField(default=0)
    
    # Metadata
    assessed_at = models.DateTimeField(auto_now_add=True)
    assessed_by = models.CharField(
        max_length=50,
        default="ai_system",
        help_text="System or user who performed the assessment"
    )
    assessment_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Full assessment data from AI system"
    )
    
    class Meta:
        ordering = ["-assessed_at"]
    
    def __str__(self) -> str:
        return f"Underwriting({self.application.id} - {self.recommendation or 'Pending'})"


class UnderwriterReport(models.Model):
    """Stores comprehensive lender-ready underwriter's reports for applications."""
    
    STATUS_CHOICES = [
        ('generating', 'Generating'),
        ('ready', 'Ready'),
        ('failed', 'Failed'),
        ('locked', 'Locked'),
    ]
    
    application = models.ForeignKey(
        Application,
        related_name='underwriter_reports',
        on_delete=models.CASCADE
    )
    lender = models.ForeignKey(
        "lenders.LenderProfile",
        related_name='underwriter_reports',
        on_delete=models.CASCADE
    )
    version = models.PositiveIntegerField(default=1, help_text="Version number for this report")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='generating')
    is_locked = models.BooleanField(default=False, help_text="If locked, report cannot be regenerated")
    
    # Report data
    report_json = models.JSONField(default=dict, help_text="Full structured JSON report")
    plain_text_narrative = models.TextField(blank=True, help_text="Human-readable narrative version")
    
    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="User who triggered report generation (admin or system)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Generation metadata
    generation_error = models.TextField(blank=True, help_text="Error message if generation failed")
    input_data_snapshot = models.JSONField(default=dict, blank=True, help_text="Snapshot of input data used")
    
    class Meta:
        ordering = ['-version', '-created_at']
        unique_together = ('application', 'lender', 'version')
        indexes = [
            models.Index(fields=['application', 'lender', '-version']),
        ]
    
    def __str__(self) -> str:
        return f"UnderwriterReport(app={self.application.id}, lender={self.lender.id}, v{self.version})"
    
    @property
    def is_latest(self):
        """Check if this is the latest version for this application/lender."""
        latest = UnderwriterReport.objects.filter(
            application=self.application,
            lender=self.lender
        ).order_by('-version').first()
        return latest and latest.id == self.id