"""Model definitions for products offered by lenders."""
from __future__ import annotations

from django.db import models
from django.conf import settings


class Product(models.Model):
    """Represents a finance product offered by a lender."""

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
        ("n/a", "N/A - Not Applicable"),  # For non-property funding types
    ]
    REPAYMENT_STRUCTURES = [
        ("interest_only", "Interest‑Only"),
        ("amortising", "Amortising"),
    ]
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("pending", "Pending Approval"),
        ("active", "Active"),
        ("inactive", "Inactive"),
    ]

    lender = models.ForeignKey(
        "lenders.LenderProfile", related_name="products", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=255)
    funding_type = models.CharField(max_length=50, choices=FUNDING_TYPES)
    property_type = models.CharField(
        max_length=20, choices=PROPERTY_TYPES, default="n/a", null=True, blank=True
    )
    description = models.TextField(blank=True)
    min_loan_amount = models.DecimalField(max_digits=15, decimal_places=2)
    max_loan_amount = models.DecimalField(max_digits=15, decimal_places=2)
    interest_rate_min = models.DecimalField(max_digits=5, decimal_places=2)
    interest_rate_max = models.DecimalField(max_digits=5, decimal_places=2)
    term_min_months = models.PositiveIntegerField()
    term_max_months = models.PositiveIntegerField()
    max_ltv_ratio = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    repayment_structure = models.CharField(max_length=20, choices=REPAYMENT_STRUCTURES)
    eligibility_criteria = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.name} ({self.lender.organisation_name})"


class FavouriteProduct(models.Model):
    """Allows borrowers to save/favourite products for later review."""
    
    borrower = models.ForeignKey(
        "borrowers.BorrowerProfile",
        related_name="favourite_products",
        on_delete=models.CASCADE,
        help_text="Borrower who favourited this product"
    )
    product = models.ForeignKey(
        Product,
        related_name="favourited_by",
        on_delete=models.CASCADE,
        help_text="Product that was favourited"
    )
    project = models.ForeignKey(
        "projects.Project",
        related_name="favourite_products",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Project this product was matched for (if applicable)"
    )
    notes = models.TextField(
        blank=True,
        help_text="Borrower's notes about this product"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ("borrower", "product", "project")
        ordering = ["-created_at"]
        verbose_name = "Favourite Product"
        verbose_name_plural = "Favourite Products"
    
    def __str__(self) -> str:
        return f"{self.borrower.user.username} favourited {self.product.name}"
