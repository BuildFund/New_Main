"""Model definition for uploaded documents."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class DocumentType(models.Model):
    """Defines document types required for loan applications."""
    
    DOCUMENT_CATEGORIES = [
        ("identity", "Identity Verification"),
        ("address", "Address Verification"),
        ("financial", "Financial Documents"),
        ("company", "Company Documents"),
        ("property", "Property Documents"),
        ("other", "Other"),
    ]
    
    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=20, choices=DOCUMENT_CATEGORIES)
    description = models.TextField(blank=True)
    required_for_loan_types = models.JSONField(
        default=list,
        help_text="List of loan types this document is required for (e.g., ['business_finance', 'construction_finance'])"
    )
    is_required = models.BooleanField(default=False, help_text="Whether this document is mandatory")
    max_file_size_mb = models.IntegerField(default=10, help_text="Maximum file size in MB")
    allowed_file_types = models.JSONField(
        default=list,
        help_text="List of allowed MIME types (e.g., ['application/pdf', 'image/jpeg'])"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ["category", "name"]
    
    def __str__(self) -> str:
        return f"{self.name} ({self.get_category_display()})"


class Document(models.Model):
    """Represents an uploaded file owned by a user."""

    VALIDATION_STATUS_CHOICES = [
        ("pending", "Pending Validation"),
        ("validating", "Validating"),
        ("valid", "Valid"),
        ("invalid", "Invalid"),
        ("error", "Validation Error"),
    ]
    
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField()
    file_type = models.CharField(max_length=50)
    upload_path = models.CharField(max_length=512)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    description = models.CharField(max_length=255, blank=True)
    
    # Document type and validation
    document_type = models.ForeignKey(
        DocumentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents",
        help_text="Type of document (e.g., Bank Statement, ID, Company Accounts)"
    )
    validation_status = models.CharField(
        max_length=20,
        choices=VALIDATION_STATUS_CHOICES,
        default="pending"
    )
    validation_score = models.IntegerField(
        null=True,
        blank=True,
        help_text="Validation score (0-100) based on file quality, format, completeness"
    )
    validation_notes = models.TextField(
        blank=True,
        help_text="Notes from validation process"
    )
    validated_at = models.DateTimeField(null=True, blank=True)
    
    # AI Assessment
    ai_assessment = models.JSONField(
        default=dict,
        blank=True,
        help_text="AI assessment results including risk score, key findings, recommendations"
    )
    ai_assessed_at = models.DateTimeField(null=True, blank=True)
    
    # File storage (for production, use S3 or similar)
    file_content = models.BinaryField(null=True, blank=True, help_text="File content (for small files only)")
    
    class Meta:
        ordering = ["-uploaded_at"]
    
    def __str__(self) -> str:  # pragma: no cover
        return f"Document({self.file_name})"
    
    def mark_as_validated(self, status: str, score: int = None, notes: str = ""):
        """Mark document as validated."""
        self.validation_status = status
        if score is not None:
            self.validation_score = score
        if notes:
            self.validation_notes = notes
        self.validated_at = timezone.now()
        self.save()