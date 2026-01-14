"""App configuration for deals module."""
from django.apps import AppConfig


class DealsConfig(AppConfig):
    """Configuration for the deals app."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'deals'
    verbose_name = 'Deal Progression'
    
    def ready(self):
        """Import signals when app is ready."""
        import deals.signals  # noqa
