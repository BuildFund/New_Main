"""Signals for deals module."""
from django.db.models.signals import post_save
from django.dispatch import receiver
from applications.models import Application
from .services import DealService


@receiver(post_save, sender=Application)
def create_deal_on_acceptance(sender, instance, created, **kwargs):
    """
    Create a Deal when an application status changes to 'accepted'.
    This is a backup signal in case the view doesn't handle it.
    """
    if instance.status == "accepted":
        # Check if deal already exists by querying the database
        # Using hasattr might not work if deal was just created in same transaction
        from .models import Deal
        deal_exists = Deal.objects.filter(application=instance).exists()
        
        if not deal_exists:
            try:
                DealService.create_deal_from_application(instance)
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Signal: Failed to create deal on application acceptance: {e}", exc_info=True)
