"""Service for matching providers to deals."""
from __future__ import annotations

from typing import List, Dict, Any
from django.db.models import Q
from consultants.models import ConsultantProfile
from .models import Deal, ProviderEnquiry


class DealProviderMatchingService:
    """Service for matching providers to deal requirements."""
    
    def find_matching_providers(
        self,
        deal: Deal,
        role_type: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Find providers that match the deal requirements for a specific role.
        
        Matching criteria:
        1. Service type match (role_type)
        2. Geographic coverage (deal location)
        3. Qualifications
        4. Experience
        5. Capacity
        """
        # Start with active, verified consultants
        providers = ConsultantProfile.objects.filter(
            is_active=True,
            is_verified=True
        )
        
        # Map role_type to service types
        role_to_service_map = {
            'valuer': ['valuation_surveyor', 'valuation_and_monitoring_surveyor'],
            'monitoring_surveyor': ['monitoring_surveyor', 'valuation_and_monitoring_surveyor'],
            'solicitor': ['solicitor'],
        }
        matching_service_types = role_to_service_map.get(role_type, [])
        
        # Filter by service type
        if matching_service_types:
            service_filter = Q()
            for service_type in matching_service_types:
                service_filter |= Q(services_offered__contains=[service_type])
            providers = providers.filter(service_filter)
        
        # Filter by geographic coverage
        # Get deal location from application project
        if deal.application and deal.application.project:
            project = deal.application.project
            deal_location = project.county or project.postcode or ''
            
            if deal_location:
                # Check if provider covers this location
                providers = providers.filter(
                    Q(geographic_coverage__contains=[deal_location]) |
                    Q(geographic_coverage=[])  # Empty means nationwide
                )
        
        # Filter by capacity
        providers_list = list(providers)
        providers_with_capacity = [
            p for p in providers_list
            if p.has_capacity()
        ]
        
        # Calculate match scores and sort
        results = []
        for provider in providers_with_capacity[:limit]:
            score = self.calculate_match_score(deal, role_type, provider)
            results.append({
                'provider': provider,
                'match_score': score,
            })
        
        # Sort by match score (descending)
        results.sort(key=lambda x: x['match_score'], reverse=True)
        
        return results
    
    def calculate_match_score(
        self,
        deal: Deal,
        role_type: str,
        provider: ConsultantProfile
    ) -> float:
        """
        Calculate a match score (0-100) for a provider-deal-role combination.
        Higher score = better match.
        """
        score = 0.0
        
        # Service type match (required, 30 points)
        role_to_service_map = {
            'valuer': ['valuation_surveyor', 'valuation_and_monitoring_surveyor'],
            'monitoring_surveyor': ['monitoring_surveyor', 'valuation_and_monitoring_surveyor'],
            'solicitor': ['solicitor'],
        }
        matching_service_types = role_to_service_map.get(role_type, [])
        
        if any(st in (provider.services_offered or []) for st in matching_service_types):
            score += 30.0
        
        # Geographic match (20 points)
        if deal.application and deal.application.project:
            project = deal.application.project
            deal_location = project.county or project.postcode or ''
            
            if deal_location:
                if deal_location in (provider.geographic_coverage or []):
                    score += 20.0
                elif not provider.geographic_coverage:  # Nationwide
                    score += 15.0
        
        # Qualification match (25 points) - basic check
        # For valuer/monitoring_surveyor, prefer RICS
        if role_type in ['valuer', 'monitoring_surveyor']:
            if 'rics' in (provider.qualifications or []):
                score += 25.0
            elif 'rics_monitoring' in (provider.qualifications or []) or 'rics_valuation' in (provider.qualifications or []):
                score += 20.0
        elif role_type == 'solicitor':
            if 'sra' in (provider.qualifications or []):
                score += 25.0
            elif 'cilex' in (provider.qualifications or []):
                score += 20.0
        
        # Experience match (15 points)
        if provider.years_of_experience:
            if provider.years_of_experience >= 5:
                score += 15.0
            elif provider.years_of_experience >= 3:
                score += 10.0
            else:
                score += 5.0
        
        # Capacity (10 points)
        if provider.max_capacity > 0:
            capacity_ratio = provider.current_capacity / provider.max_capacity
            score += (1.0 - capacity_ratio) * 10.0
        
        return min(100.0, score)
