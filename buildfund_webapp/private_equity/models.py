"""Model definitions for the private equity module."""

from __future__ import annotations

from django.db import models


class PrivateEquityOpportunity(models.Model):
    """
    Represents a private equity opportunity submitted by a borrower.  An
    opportunity describes the business, funding requirements and equity
    offering.  Admins can approve or decline a submission.  Approved
    opportunities are visible to lenders/investors.
    """

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("pending_review", "Pending Review"),
        ("approved", "Approved"),
        ("declined", "Declined"),
    ]

    borrower = models.ForeignKey(
        "borrowers.BorrowerProfile", related_name="private_equity_opportunities", on_delete=models.CASCADE
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    industry = models.CharField(max_length=100, blank=True)
    funding_required = models.DecimalField(max_digits=15, decimal_places=2)
    valuation = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    share_offered = models.DecimalField(max_digits=5, decimal_places=2, help_text="Percentage equity offered")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:  # pragma: no cover
        return f"PEOpportunity({self.title})"


class PrivateEquityInvestment(models.Model):
    """
    Represents an investment or offer made by a lender towards a private
    equity opportunity.  Lenders specify an amount and equity share
    they are willing to invest.  The status indicates whether the
    investment has been accepted by the borrower.
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("rejected", "Rejected"),
    ]

    opportunity = models.ForeignKey(
        PrivateEquityOpportunity, related_name="investments", on_delete=models.CASCADE
    )
    lender = models.ForeignKey(
        "lenders.LenderProfile", related_name="private_equity_investments", on_delete=models.CASCADE
    )
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    share = models.DecimalField(max_digits=5, decimal_places=2, help_text="Percentage equity offered for this investment")
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ["opportunity", "lender"]

    def __str__(self) -> str:  # pragma: no cover
        return f"PEInvestment({self.lender} → {self.opportunity})"