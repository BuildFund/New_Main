"""Signals for consultant app."""
from django.db.models.signals import post_save
from django.dispatch import receiver
from applications.models import Application
from .models import ConsultantService
from .services import ConsultantNotificationService


@receiver(post_save, sender=Application)
def create_consultant_services_on_acceptance(sender, instance, created, **kwargs):
    """
    When an application is accepted, create consultant service requests
    for Monitoring Surveyor, Valuation, and Solicitor.
    """
    # Only create services when status changes to "accepted"
    if instance.status == "accepted":
        # Check if services already exist
        existing_services = ConsultantService.objects.filter(application=instance)
        if existing_services.exists():
            return  # Services already created
        
        # Create required consultant services
        services_to_create = [
            {
                "service_type": "monitoring_surveyor",
                "description": "Monitoring surveyor required for loan monitoring and progress reports",
                "required_qualifications": ["rics_monitoring", "rics"],
            },
            {
                "service_type": "valuation",
                "description": "Property valuation required for loan security",
                "required_qualifications": ["rics_valuation", "rics"],
            },
            {
                "service_type": "solicitor",
                "description": "Solicitor required for loan conveyance and legal documentation",
                "required_qualifications": ["sra", "cilex"],
            },
        ]
        
        # Get project location for geographic matching
        project = instance.project
        geographic_location = f"{project.county}, {project.postcode}" if project.county else project.postcode
        
        for service_data in services_to_create:
            service = ConsultantService.objects.create(
                application=instance,
                service_type=service_data["service_type"],
                description=service_data["description"],
                required_qualifications=service_data["required_qualifications"],
                geographic_requirement=geographic_location,
                status="pending",
            )
            
            # Notify matching consultants
            notification_service = ConsultantNotificationService()
            notification_service.notify_consultants_of_service_request(service)
