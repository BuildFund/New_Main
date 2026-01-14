"""Models for Underwriter's Report."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class UnderwriterReport(models.Model):
    """Stores AI-generated underwriter's reports for applications."""
    
    STATUS_CHOICES = [
        ('generating', 'Generating'),
        ('ready', 'Ready'),
        ('failed', 'Failed'),
        ('locked', 'Locked'),
    ]
    
    application = models.ForeignKey(
        'applications.Application',
        related_name='underwriter_reports',
        on_delete=models.CASCADE
    )
    lender = models.ForeignKey(
        'lenders.LenderProfile',
        related_name='underwriter_reports',
        on_delete=models.CASCADE,
        help_text="Lender this report is for"
    )
    
    version = models.PositiveIntegerField(default=1, help_text="Report version number")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='generating')
    
    # Report content
    report_json = models.JSONField(
        default=dict,
        blank=True,
        help_text="Full structured JSON report"
    )
    plain_text_narrative = models.TextField(
        blank=True,
        help_text="Human-readable narrative version"
    )
    
    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='underwriter_reports_created',
        help_text="User/system that triggered report generation"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Locking
    is_locked = models.BooleanField(
        default=False,
        help_text="If locked, report cannot be regenerated"
    )
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='underwriter_reports_locked',
        help_text="Admin who locked the report"
    )
    locked_at = models.DateTimeField(null=True, blank=True)
    
    # Error tracking
    generation_error = models.TextField(
        blank=True,
        help_text="Error message if generation failed"
    )
    
    class Meta:
        ordering = ['-version', '-created_at']
        unique_together = ('application', 'lender', 'version')
        indexes = [
            models.Index(fields=['application', 'lender', 'status']),
            models.Index(fields=['application', 'lender', '-version']),
        ]
    
    def __str__(self):
        return f"UnderwriterReport({self.application.id} - {self.lender.organisation_name} - v{self.version})"
    
    def get_latest_for_application_lender(application, lender):
        """Get the latest version of report for an application and lender."""
        return UnderwriterReport.objects.filter(
            application=application,
            lender=lender
        ).order_by('-version').first()


class UnderwriterReportAudit(models.Model):
    """Audit log for underwriter report access and actions."""
    
    ACTION_CHOICES = [
        ('generated', 'Report Generated'),
        ('viewed', 'Report Viewed'),
        ('exported', 'Report Exported (PDF)'),
        ('regenerated', 'Report Regenerated'),
        ('locked', 'Report Locked'),
        ('unlocked', 'Report Unlocked'),
    ]
    
    report = models.ForeignKey(
        UnderwriterReport,
        related_name='audit_logs',
        on_delete=models.CASCADE
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='underwriter_report_audits'
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['report', 'action']),
            models.Index(fields=['user', 'created_at']),
        ]
    
    def __str__(self):
        return f"Audit({self.report.id} - {self.action} - {self.created_at})"
