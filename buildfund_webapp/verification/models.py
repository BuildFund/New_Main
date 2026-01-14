"""Models for storing verification results."""
from __future__ import annotations

from django.db import models
from django.conf import settings


class CompanyVerification(models.Model):
    """Stores company verification results from HMRC/Companies House API."""
    
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("verified", "Verified"),
        ("failed", "Failed"),
        ("error", "Error"),
    ]
    
    borrower_profile = models.OneToOneField(
        "borrowers.BorrowerProfile",
        related_name="company_verification",
        on_delete=models.CASCADE,
    )
    company_number = models.CharField(max_length=20)
    company_name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    verified_at = models.DateTimeField(null=True, blank=True)
    verification_data = models.JSONField(default=dict, blank=True)  # Store API response
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self) -> str:
        return f"CompanyVerification({self.company_number} - {self.status})"


class DirectorVerification(models.Model):
    """Stores director verification results."""
    
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("verified", "Verified"),
        ("failed", "Failed"),
        ("error", "Error"),
    ]
    
    borrower_profile = models.ForeignKey(
        "borrowers.BorrowerProfile",
        related_name="director_verifications",
        on_delete=models.CASCADE,
    )
    company_number = models.CharField(max_length=20)
    director_name = models.CharField(max_length=255)
    date_of_birth = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    verified_at = models.DateTimeField(null=True, blank=True)
    verification_data = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self) -> str:
        return f"DirectorVerification({self.director_name} - {self.status})"
