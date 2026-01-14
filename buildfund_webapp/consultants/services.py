"""Services for consultant matching and notifications."""
from __future__ import annotations

from typing import List, Dict, Any
from django.db.models import Q
from .models import ConsultantProfile, ConsultantService


class ConsultantMatchingService:
    """Service for matching consultants to service requests."""
    
    def find_matching_consultants(
        self,
        service: ConsultantService,
        limit: int = 10
    ) -> List[ConsultantProfile]:
        """
        Find consultants that match the service requirements.
        
        Matching criteria:
        1. Service type match
        2. Geographic coverage
        3. Qualifications
        4. Experience
        5. Capacity
        """
        # Start with active, verified consultants
        consultants = ConsultantProfile.objects.filter(
            is_active=True,
            is_verified=True
        )
        
        # Filter by service type
        consultants = consultants.filter(
            services_offered__contains=[service.service_type]
        )
        
        # Filter by geographic coverage if specified
        if service.geographic_requirement:
            consultants = consultants.filter(
                Q(geographic_coverage__contains=[service.geographic_requirement]) |
                Q(geographic_coverage=[])  # Empty means nationwide
            )
        
        # Filter by qualifications if specified
        if service.required_qualifications:
            for qual in service.required_qualifications:
                consultants = consultants.filter(
                    qualifications__contains=[qual]
                )
        
        # Filter by minimum experience if specified
        if service.minimum_experience_years:
            consultants = consultants.filter(
                years_of_experience__gte=service.minimum_experience_years
            )
        
        # Convert to list for capacity filtering (can't use F() in filter for capacity comparison)
        consultants_list = list(consultants)
        
        # Filter by capacity - consultants with available capacity
        consultants_list = [c for c in consultants_list if c.current_capacity < c.max_capacity]
        
        # Sort by: capacity (more available first), response time, experience
        consultants_list = sorted(
            consultants_list,
            key=lambda c: (
                c.current_capacity,  # Lower capacity = more available
                c.average_response_time_days or 999,  # Lower response time = better
                -(c.years_of_experience or 0)  # Higher experience = better (negative for reverse sort)
            )
        )
        
        return consultants_list[:limit]
    
    def calculate_match_score(
        self,
        consultant: ConsultantProfile,
        service: ConsultantService
    ) -> float:
        """
        Calculate a match score (0-100) for a consultant-service pair.
        Higher score = better match.
        """
        score = 0.0
        
        # Service type match (required, 30 points)
        if service.service_type in consultant.services_offered:
            score += 30.0
        
        # Geographic match (20 points)
        if service.geographic_requirement:
            if service.geographic_requirement in consultant.geographic_coverage:
                score += 20.0
            elif not consultant.geographic_coverage:  # Nationwide
                score += 15.0
        
        # Qualification match (25 points)
        if service.required_qualifications:
            matched_quals = sum(
                1 for q in service.required_qualifications
                if q in consultant.qualifications
            )
            if matched_quals > 0:
                score += (matched_quals / len(service.required_qualifications)) * 25.0
        
        # Experience match (15 points)
        if service.minimum_experience_years:
            if consultant.years_of_experience and consultant.years_of_experience >= service.minimum_experience_years:
                score += 15.0
        
        # Capacity (10 points)
        capacity_ratio = consultant.current_capacity / consultant.max_capacity if consultant.max_capacity > 0 else 1.0
        score += (1.0 - capacity_ratio) * 10.0
        
        return min(100.0, score)


class ConsultantNotificationService:
    """Service for notifying consultants about new service requests."""
    
    def notify_consultants_of_service_request(self, service: ConsultantService):
        """
        Notify matching consultants about a new service request.
        This would typically send emails or create in-app notifications.
        """
        matching_service = ConsultantMatchingService()
        matching_consultants = matching_service.find_matching_consultants(service, limit=20)
        
        # Create in-app notifications (if Notification model exists)
        try:
            from notifications.models import Notification
            for consultant in matching_consultants:
                Notification.objects.create(
                    user=consultant.user,
                    notification_type="consultant_service_opportunity",
                    title=f"New {service.get_service_type_display()} Service Request",
                    message=f"A new {service.get_service_type_display()} service is required for Application #{service.application.id}. Submit your quote now.",
                    related_object_type="consultant_service",
                    related_object_id=service.id,
                    action_url=f"/consultant/services/{service.id}/quote",
                )
        except ImportError:
            # Notification model doesn't exist, skip
            pass
        
        # Send email notifications
        try:
            from notifications.services import EmailNotificationService
            for consultant in matching_consultants:
                EmailNotificationService.send_email(
                    subject=f"New {service.get_service_type_display()} Service Opportunity",
                    message=f"""
A new {service.get_service_type_display()} service is required for Application #{service.application.id}.

Service Details:
- Type: {service.get_service_type_display()}
- Description: {service.description}
- Required by: {service.required_by_date or 'Not specified'}
- Location: {service.geographic_requirement or 'Not specified'}

Log in to your BuildFund dashboard to submit your quote.

Best regards,
BuildFund Team
                    """.strip(),
                    recipient_list=[consultant.contact_email or consultant.user.email],
                )
        except ImportError:
            # Email service doesn't exist, skip
            pass
