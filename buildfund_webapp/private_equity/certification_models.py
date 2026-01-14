"""Models for FCA self-certification for Private Equity access."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class FCASelfCertification(models.Model):
    """Stores FCA self-certification records for Private Equity access."""
    
    CERTIFICATION_TYPES = [
        ("sophisticated", "Sophisticated Investor"),
        ("high_net_worth", "High Net Worth Individual"),
        ("restricted", "Restricted Investor"),
        ("certified", "Certified Sophisticated Investor"),
    ]
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="fca_certification"
    )
    
    # Certification details
    certification_type = models.CharField(
        max_length=50,
        choices=CERTIFICATION_TYPES,
        help_text="Type of FCA self-certification"
    )
    
    # FCA Required Declarations
    is_high_net_worth = models.BooleanField(
        default=False,
        help_text="I confirm I am a high net worth individual (annual income > £100k or net assets > £250k)"
    )
    
    is_sophisticated = models.BooleanField(
        default=False,
        help_text="I confirm I am a sophisticated investor with knowledge and experience in unlisted securities"
    )
    
    understands_risks = models.BooleanField(
        default=False,
        help_text="I understand that investments in unlisted securities carry significant risks"
    )
    
    understands_illiquidity = models.BooleanField(
        default=False,
        help_text="I understand that these investments may be difficult to sell and may lose value"
    )
    
    can_afford_loss = models.BooleanField(
        default=False,
        help_text="I can afford to lose my entire investment without affecting my standard of living"
    )
    
    has_received_advice = models.BooleanField(
        default=False,
        help_text="I have received appropriate advice or have sufficient experience to make this decision"
    )
    
    # Additional information
    annual_income = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Annual income in GBP (optional, for high net worth certification)"
    )
    
    net_assets = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Net assets in GBP (optional, for high net worth certification)"
    )
    
    investment_experience_years = models.IntegerField(
        null=True,
        blank=True,
        help_text="Years of investment experience (optional)"
    )
    
    # Compliance fields
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address from which certification was submitted"
    )
    
    user_agent = models.TextField(
        blank=True,
        help_text="User agent string from browser"
    )
    
    certified_at = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)
    
    # Status
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this certification is currently active"
    )
    
    # Notes (for compliance/admin)
    admin_notes = models.TextField(
        blank=True,
        help_text="Admin notes (not visible to user)"
    )
    
    class Meta:
        verbose_name = "FCA Self-Certification"
        verbose_name_plural = "FCA Self-Certifications"
        ordering = ["-certified_at"]
    
    def __str__(self) -> str:
        return f"FCA Certification({self.user.email} - {self.get_certification_type_display()})"
    
    def is_valid(self) -> bool:
        """Check if certification is valid and meets FCA requirements."""
        if not self.is_active:
            return False
        
        # All required declarations must be true
        required_fields = [
            self.understands_risks,
            self.understands_illiquidity,
            self.can_afford_loss,
            self.has_received_advice,
        ]
        
        if not all(required_fields):
            return False
        
        # For high net worth, must confirm high net worth status
        if self.certification_type == "high_net_worth":
            return self.is_high_net_worth
        
        # For sophisticated, must confirm sophisticated status
        if self.certification_type in ["sophisticated", "certified"]:
            return self.is_sophisticated
        
        return True
    
    def get_certification_summary(self) -> dict:
        """Get a summary of the certification for display."""
        return {
            "type": self.get_certification_type_display(),
            "certified_at": self.certified_at.isoformat(),
            "is_valid": self.is_valid(),
            "annual_income": float(self.annual_income) if self.annual_income else None,
            "net_assets": float(self.net_assets) if self.net_assets else None,
            "investment_experience_years": self.investment_experience_years,
        }
