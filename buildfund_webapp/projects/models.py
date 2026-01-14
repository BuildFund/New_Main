"""Model definitions for borrower projects."""
from __future__ import annotations

import random
import string
from django.conf import settings
from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver


class Project(models.Model):
    """Represents a property development project submitted by a borrower."""

    FUNDING_TYPES = [
        # Property & Development Finance (Primary)
        ("development_finance", "Development Finance"),
        ("senior_debt", "Senior Debt/Development Finance"),
        ("commercial_mortgage", "Commercial Mortgages"),
        ("mortgage", "Mortgage Finance"),
        ("equity", "Equity Finance"),
        # Alternative Business Finance
        ("revenue_based", "Revenue Based Funding"),
        ("merchant_cash_advance", "Merchant Cash Advance"),
        ("term_loan_p2p", "Term Loans (Peer-to-Peer)"),
        ("bank_overdraft", "Bank Overdraft"),
        ("business_credit_card", "Business Credit Cards"),
        # Asset-Based Finance
        ("ip_funding", "Intellectual Property (IP) Funding"),
        ("stock_finance", "Stock Finance"),
        ("asset_finance", "Asset Finance"),
        ("factoring", "Factoring / Invoice Discounting"),
        # Trade & Export Finance
        ("trade_finance", "Trade Finance"),
        ("export_finance", "Export Finance"),
        # Public Sector
        ("public_sector_startup", "Public Sector Funding (Start Up Loan)"),
    ]
    PROPERTY_TYPES = [
        ("residential", "Residential"),
        ("commercial", "Commercial"),
        ("mixed", "Mixed"),
        ("industrial", "Industrial"),
    ]
    DEVELOPMENT_EXTENTS = [
        ("light_refurb", "Light Refurb"),
        ("heavy_refurb", "Heavy Refurb"),
        ("conversion", "Conversion"),
        ("new_build", "New Build"),
    ]
    TENURE_CHOICES = [
        ("freehold", "Freehold"),
        ("leasehold", "Leasehold"),
    ]
    REPAYMENT_METHODS = [
        ("sale", "Sale"),
        ("refinance", "Refinance"),
    ]
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("pending_review", "Pending Review"),
        ("approved", "Approved"),
        ("declined", "Declined"),
    ]

    borrower = models.ForeignKey(
        "borrowers.BorrowerProfile", related_name="projects", on_delete=models.CASCADE
    )
    project_reference = models.CharField(
        max_length=6,
        unique=True,
        blank=True,
        null=True,
        help_text="Unique short identifier for this project (auto-generated)"
    )
    funding_type = models.CharField(max_length=30, choices=FUNDING_TYPES)
    property_type = models.CharField(max_length=20, choices=PROPERTY_TYPES)
    address = models.CharField(max_length=255)
    town = models.CharField(max_length=100)
    county = models.CharField(max_length=100)
    postcode = models.CharField(max_length=20)
    description = models.TextField(blank=True)
    development_extent = models.CharField(max_length=20, choices=DEVELOPMENT_EXTENTS)
    tenure = models.CharField(max_length=20, choices=TENURE_CHOICES)
    planning_permission = models.BooleanField(default=False)
    planning_authority = models.CharField(max_length=100, blank=True)
    planning_reference = models.CharField(max_length=100, blank=True)
    planning_description = models.TextField(blank=True)
    loan_amount_required = models.DecimalField(max_digits=15, decimal_places=2)
    term_required_months = models.PositiveIntegerField(null=True, blank=True, help_text="Optional for some funding types")
    repayment_method = models.CharField(max_length=20, choices=REPAYMENT_METHODS)
    unit_counts = models.JSONField(default=dict)
    gross_internal_area = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    purchase_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    purchase_costs = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    build_cost = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    current_market_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    gross_development_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    funds_provided_by_applicant = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    source_of_funds = models.CharField(max_length=255, blank=True)
    existing_mortgage = models.BooleanField(default=False)
    mortgage_company = models.CharField(max_length=100, blank=True)
    mortgage_balance = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def calculate_ltv_ratio(self) -> float | None:
        """
        Calculate the Loan-to-Value (LTV) ratio for this project.
        
        LTV = (Loan Amount / Property Value) * 100
        
        Uses gross_development_value if available, otherwise current_market_value.
        Returns None if no property value is available.
        """
        if not self.loan_amount_required:
            return None
        
        # Prefer GDV over current market value for development projects
        property_value = self.gross_development_value or self.current_market_value
        
        if not property_value or property_value <= 0:
            return None
        
        ltv = (float(self.loan_amount_required) / float(property_value)) * 100
        return round(ltv, 2)

    def generate_reference(self) -> str:
        """
        Generate a unique 6-character alphanumeric reference code.
        Uses uppercase letters and numbers, excluding ambiguous characters (0, O, I, 1).
        """
        # Characters: A-Z (excluding I, O) and 2-9 (excluding 0, 1)
        chars = string.ascii_uppercase.replace('I', '').replace('O', '') + '23456789'
        max_attempts = 100
        
        for _ in range(max_attempts):
            reference = ''.join(random.choices(chars, k=6))
            # Check if this reference already exists (exclude current instance if updating)
            qs = Project.objects.filter(project_reference=reference)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if not qs.exists():
                return reference
        
        # Fallback: if we can't find a unique one, use a longer approach
        # This should be extremely rare
        import time
        reference = ''.join(random.choices(chars, k=5)) + str(int(time.time()) % 10)
        return reference[:6]

    def __str__(self) -> str:  # pragma: no cover
        ref = self.project_reference or f"#{self.id}"
        return f"Project({ref} - {self.description[:30] if self.description else 'No description'}…)"


@receiver(pre_save, sender=Project)
def generate_project_reference(sender, instance, **kwargs):
    """Auto-generate project reference if not set."""
    # Only generate if reference is missing or empty
    if not instance.project_reference or (isinstance(instance.project_reference, str) and not instance.project_reference.strip()):
        try:
            # Only generate if this is a new project or updating an existing one without a reference
            if not instance.pk or not Project.objects.filter(pk=instance.pk).exclude(project_reference__isnull=True).exclude(project_reference='').exists():
                instance.project_reference = instance.generate_reference()
        except Exception as e:
            # If generation fails, use a fallback based on ID
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to generate project reference for project {getattr(instance, 'id', 'new')}: {e}")
            # Fallback: use project ID padded to 6 chars
            if instance.pk:
                instance.project_reference = f"P{instance.pk:05d}"[:6]
            else:
                # For new projects, generate a simple timestamp-based one
                import time
                instance.project_reference = f"{int(time.time()) % 1000000:06d}"[:6]