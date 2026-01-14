"""Model definitions for non-property funding requests."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class FundingRequest(models.Model):
    """Represents a funding request that is not property/development specific."""
    
    FUNDING_TYPES = [
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
    
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("pending_review", "Pending Review"),
        ("approved", "Approved"),
        ("declined", "Declined"),
    ]
    
    borrower = models.ForeignKey(
        "borrowers.BorrowerProfile", related_name="funding_requests", on_delete=models.CASCADE
    )
    funding_type = models.CharField(max_length=30, choices=FUNDING_TYPES)
    request_reference = models.CharField(
        max_length=10,
        unique=True,
        blank=True,
        null=True,
        help_text="Unique identifier for this funding request"
    )
    
    # Common fields
    amount_required = models.DecimalField(max_digits=15, decimal_places=2)
    term_required_months = models.PositiveIntegerField(null=True, blank=True)
    purpose = models.TextField(help_text="Purpose of the funding")
    description = models.TextField(blank=True)
    
    # Funding type specific data (stored as JSON for flexibility)
    funding_specific_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional data specific to the funding type (e.g., revenue for revenue-based, IP details for IP funding)"
    )
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ["-created_at"]
    
    def __str__(self) -> str:
        ref = self.request_reference or f"#{self.id}"
        return f"FundingRequest({ref} - {self.get_funding_type_display()})"
