"""App configuration for consultants."""
from django.apps import AppConfig


class ConsultantsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'consultants'
    
    def ready(self):
        """Import signals when app is ready."""
        import consultants.signals  # noqa
