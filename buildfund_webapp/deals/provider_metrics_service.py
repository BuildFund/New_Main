"""
Service for calculating provider performance metrics and SLA tracking.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from django.utils import timezone
from django.db.models import Q, Avg, Count, Min, Max, F, ExpressionWrapper, DurationField
from django.db.models.functions import Extract
from statistics import median

from .models import (
    ProviderEnquiry, ProviderQuote, DealProviderSelection,
    ProviderDeliverable, ProviderAppointment, PerformanceMetric, Deal
)
from consultants.models import ConsultantProfile


class ProviderMetricsService:
    """Service for calculating provider performance metrics."""
    
    @staticmethod
    def calculate_quote_response_time(provider_firm: ConsultantProfile, role_type: Optional[str] = None, 
                                     period_start: Optional[datetime] = None, 
                                     period_end: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Calculate quote response time metrics for a provider firm.
        Returns: average, median, min, max in hours, and count.
        """
        enquiries = ProviderEnquiry.objects.filter(provider_firm=provider_firm)
        
        if role_type:
            enquiries = enquiries.filter(role_type=role_type)
        
        if period_start:
            enquiries = enquiries.filter(sent_at__gte=period_start)
        if period_end:
            enquiries = enquiries.filter(sent_at__lte=period_end)
        
        # Get enquiries that have quotes
        enquiries_with_quotes = enquiries.filter(quotes__isnull=False).distinct()
        
        response_times = []
        for enquiry in enquiries_with_quotes:
            quote = enquiry.quotes.order_by('submitted_at').first()
            if quote and quote.submitted_at and enquiry.sent_at:
                delta = quote.submitted_at - enquiry.sent_at
                hours = delta.total_seconds() / 3600
                response_times.append(hours)
        
        if not response_times:
            return {
                'average_value': 0,
                'median_value': 0,
                'min_value': 0,
                'max_value': 0,
                'count': 0,
            }
        
        return {
            'average_value': sum(response_times) / len(response_times),
            'median_value': median(response_times),
            'min_value': min(response_times),
            'max_value': max(response_times),
            'count': len(response_times),
        }
    
    @staticmethod
    def calculate_quote_acceptance_rate(provider_firm: ConsultantProfile, role_type: Optional[str] = None,
                                       period_start: Optional[datetime] = None,
                                       period_end: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Calculate quote acceptance rate (percentage of quotes accepted).
        Returns: acceptance_rate (0-100), total_quotes, accepted_quotes.
        """
        quotes = ProviderQuote.objects.filter(enquiry__provider_firm=provider_firm)
        
        if role_type:
            quotes = quotes.filter(role_type=role_type)
        
        if period_start:
            quotes = quotes.filter(submitted_at__gte=period_start)
        if period_end:
            quotes = quotes.filter(submitted_at__lte=period_end)
        
        total_quotes = quotes.count()
        accepted_quotes = quotes.filter(status='accepted').count()
        
        acceptance_rate = (accepted_quotes / total_quotes * 100) if total_quotes > 0 else 0
        
        return {
            'average_value': acceptance_rate,  # Store as percentage
            'median_value': None,
            'min_value': None,
            'max_value': None,
            'count': total_quotes,
            'accepted_count': accepted_quotes,
        }
    
    @staticmethod
    def calculate_deliverable_delivery_time(provider_firm: ConsultantProfile, role_type: Optional[str] = None,
                                           deliverable_type: Optional[str] = None,
                                           period_start: Optional[datetime] = None,
                                           period_end: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Calculate deliverable delivery time (from instruction/selection to approval).
        Returns: average, median, min, max in days, and count.
        """
        deliverables = ProviderDeliverable.objects.filter(
            provider_firm=provider_firm,
            status='approved'
        )
        
        if role_type:
            deliverables = deliverables.filter(role_type=role_type)
        if deliverable_type:
            deliverables = deliverables.filter(deliverable_type=deliverable_type)
        if period_start:
            deliverables = deliverables.filter(uploaded_at__gte=period_start)
        if period_end:
            deliverables = deliverables.filter(uploaded_at__lte=period_end)
        
        delivery_times = []
        for deliverable in deliverables:
            # Get when provider was selected/instructed
            selection = DealProviderSelection.objects.filter(
                deal=deliverable.deal,
                role_type=deliverable.role_type,
                provider_firm=provider_firm
            ).first()
            
            if selection and selection.selected_at and deliverable.reviewed_at:
                delta = deliverable.reviewed_at - selection.selected_at
                days = delta.total_seconds() / (3600 * 24)
                delivery_times.append(days)
            elif deliverable.uploaded_at and deliverable.reviewed_at:
                # Fallback: use uploaded_at to reviewed_at
                delta = deliverable.reviewed_at - deliverable.uploaded_at
                days = delta.total_seconds() / (3600 * 24)
                delivery_times.append(days)
        
        if not delivery_times:
            return {
                'average_value': 0,
                'median_value': 0,
                'min_value': 0,
                'max_value': 0,
                'count': 0,
            }
        
        return {
            'average_value': sum(delivery_times) / len(delivery_times),
            'median_value': median(delivery_times),
            'min_value': min(delivery_times),
            'max_value': max(delivery_times),
            'count': len(delivery_times),
        }
    
    @staticmethod
    def calculate_deliverable_rework_count(provider_firm: ConsultantProfile, role_type: Optional[str] = None,
                                          period_start: Optional[datetime] = None,
                                          period_end: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Calculate number of rejected/revised deliverables (rework).
        Returns: total_rework_count, rework_rate (percentage).
        """
        deliverables = ProviderDeliverable.objects.filter(provider_firm=provider_firm)
        
        if role_type:
            deliverables = deliverables.filter(role_type=role_type)
        if period_start:
            deliverables = deliverables.filter(uploaded_at__gte=period_start)
        if period_end:
            deliverables = deliverables.filter(uploaded_at__lte=period_end)
        
        total_deliverables = deliverables.count()
        reworked = deliverables.filter(status__in=['rejected', 'revised']).count()
        rework_rate = (reworked / total_deliverables * 100) if total_deliverables > 0 else 0
        
        return {
            'average_value': reworked,  # Store rework count
            'median_value': None,
            'min_value': None,
            'max_value': None,
            'count': total_deliverables,
            'rework_rate': rework_rate,
        }
    
    @staticmethod
    def calculate_appointment_lead_time(provider_firm: ConsultantProfile, role_type: Optional[str] = None,
                                       period_start: Optional[datetime] = None,
                                       period_end: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Calculate appointment lead time (from proposal to confirmation).
        Returns: average, median, min, max in hours, and count.
        """
        appointments = ProviderAppointment.objects.filter(
            provider_firm=provider_firm,
            status='confirmed'
        )
        
        if role_type:
            appointments = appointments.filter(role_type=role_type)
        if period_start:
            appointments = appointments.filter(created_at__gte=period_start)
        if period_end:
            appointments = appointments.filter(created_at__lte=period_end)
        
        lead_times = []
        for appointment in appointments:
            if appointment.confirmed_at and appointment.created_at:
                delta = appointment.confirmed_at - appointment.created_at
                hours = delta.total_seconds() / 3600
                lead_times.append(hours)
        
        if not lead_times:
            return {
                'average_value': 0,
                'median_value': 0,
                'min_value': 0,
                'max_value': 0,
                'count': 0,
            }
        
        return {
            'average_value': sum(lead_times) / len(lead_times),
            'median_value': median(lead_times),
            'min_value': min(lead_times),
            'max_value': max(lead_times),
            'count': len(lead_times),
        }
    
    @staticmethod
    def calculate_provider_metrics_for_deal(deal_id: str, provider_firm: ConsultantProfile, 
                                           role_type: str) -> Dict[str, Any]:
        """
        Calculate all provider metrics for a specific deal.
        Returns comprehensive metrics dictionary.
        """
        try:
            deal = Deal.objects.get(deal_id=deal_id)
        except Deal.DoesNotExist:
            return {}
        
        # Get deal-specific data
        enquiries = ProviderEnquiry.objects.filter(deal=deal, provider_firm=provider_firm, role_type=role_type)
        quotes = ProviderQuote.objects.filter(enquiry__deal=deal, role_type=role_type, enquiry__provider_firm=provider_firm)
        deliverables = ProviderDeliverable.objects.filter(deal=deal, provider_firm=provider_firm, role_type=role_type)
        appointments = ProviderAppointment.objects.filter(deal=deal, provider_firm=provider_firm, role_type=role_type)
        
        metrics = {
            'provider_firm_name': provider_firm.organisation_name,
            'role_type': role_type,
            'deal_id': deal_id,
        }
        
        # Quote response time for this deal
        enquiry = enquiries.first()
        if enquiry:
            quote = quotes.order_by('submitted_at').first()
            if quote and quote.submitted_at and enquiry.sent_at:
                delta = quote.submitted_at - enquiry.sent_at
                metrics['quote_response_time_hours'] = delta.total_seconds() / 3600
            else:
                metrics['quote_response_time_hours'] = None
        
        # Quote acceptance
        if quotes.exists():
            metrics['quote_submitted'] = True
            metrics['quote_accepted'] = quotes.filter(status='accepted').exists()
        else:
            metrics['quote_submitted'] = False
            metrics['quote_accepted'] = False
        
        # Deliverable metrics
        approved_deliverables = deliverables.filter(status='approved')
        rejected_deliverables = deliverables.filter(status='rejected')
        metrics['deliverables_approved'] = approved_deliverables.count()
        metrics['deliverables_rejected'] = rejected_deliverables.count()
        metrics['deliverables_total'] = deliverables.count()
        
        if approved_deliverables.exists():
            # Calculate average delivery time
            delivery_times = []
            selection = DealProviderSelection.objects.filter(
                deal=deal,
                role_type=role_type,
                provider_firm=provider_firm
            ).first()
            
            for deliverable in approved_deliverables:
                if selection and selection.selected_at and deliverable.reviewed_at:
                    delta = deliverable.reviewed_at - selection.selected_at
                    delivery_times.append(delta.total_seconds() / (3600 * 24))
            
            if delivery_times:
                metrics['average_delivery_time_days'] = sum(delivery_times) / len(delivery_times)
            else:
                metrics['average_delivery_time_days'] = None
        else:
            metrics['average_delivery_time_days'] = None
        
        # Appointment metrics
        confirmed_appointments = appointments.filter(status='confirmed')
        metrics['appointments_confirmed'] = confirmed_appointments.count()
        metrics['appointments_total'] = appointments.count()
        
        if confirmed_appointments.exists():
            lead_times = []
            for appointment in confirmed_appointments:
                if appointment.confirmed_at and appointment.created_at:
                    delta = appointment.confirmed_at - appointment.created_at
                    lead_times.append(delta.total_seconds() / 3600)
            if lead_times:
                metrics['average_appointment_lead_time_hours'] = sum(lead_times) / len(lead_times)
            else:
                metrics['average_appointment_lead_time_hours'] = None
        else:
            metrics['average_appointment_lead_time_hours'] = None
        
        return metrics
    
    @staticmethod
    def generate_performance_metrics(provider_firm: ConsultantProfile, role_type: Optional[str] = None,
                                    period_start: Optional[datetime] = None,
                                    period_end: Optional[datetime] = None) -> List[PerformanceMetric]:
        """
        Generate and save PerformanceMetric records for a provider firm.
        Returns list of created/updated metrics.
        """
        if not period_start:
            period_start = timezone.now() - timedelta(days=90)  # Default: last 90 days
        if not period_end:
            period_end = timezone.now()
        
        metrics = []
        
        # Quote response time
        quote_response = ProviderMetricsService.calculate_quote_response_time(
            provider_firm, role_type, period_start, period_end
        )
        if quote_response['count'] > 0:
            metric, created = PerformanceMetric.objects.update_or_create(
                provider_firm=provider_firm,
                role_type=role_type,
                metric_type='quote_response_time',
                period_start=period_start.date(),
                period_end=period_end.date(),
                defaults={
                    'average_value': quote_response['average_value'],
                    'median_value': quote_response['median_value'],
                    'min_value': quote_response['min_value'],
                    'max_value': quote_response['max_value'],
                    'count': quote_response['count'],
                }
            )
            metrics.append(metric)
        
        # Quote acceptance rate
        acceptance = ProviderMetricsService.calculate_quote_acceptance_rate(
            provider_firm, role_type, period_start, period_end
        )
        if acceptance['count'] > 0:
            metric, created = PerformanceMetric.objects.update_or_create(
                provider_firm=provider_firm,
                role_type=role_type,
                metric_type='quote_acceptance_rate',
                period_start=period_start.date(),
                period_end=period_end.date(),
                defaults={
                    'average_value': acceptance['average_value'],
                    'count': acceptance['count'],
                }
            )
            metrics.append(metric)
        
        # Deliverable delivery time
        delivery = ProviderMetricsService.calculate_deliverable_delivery_time(
            provider_firm, role_type, None, period_start, period_end
        )
        if delivery['count'] > 0:
            metric, created = PerformanceMetric.objects.update_or_create(
                provider_firm=provider_firm,
                role_type=role_type,
                metric_type='deliverable_delivery_time',
                period_start=period_start.date(),
                period_end=period_end.date(),
                defaults={
                    'average_value': delivery['average_value'],
                    'median_value': delivery['median_value'],
                    'min_value': delivery['min_value'],
                    'max_value': delivery['max_value'],
                    'count': delivery['count'],
                }
            )
            metrics.append(metric)
        
        # Deliverable rework count
        rework = ProviderMetricsService.calculate_deliverable_rework_count(
            provider_firm, role_type, period_start, period_end
        )
        if rework['count'] > 0:
            metric, created = PerformanceMetric.objects.update_or_create(
                provider_firm=provider_firm,
                role_type=role_type,
                metric_type='deliverable_rework_count',
                period_start=period_start.date(),
                period_end=period_end.date(),
                defaults={
                    'average_value': rework['average_value'],
                    'count': rework['count'],
                }
            )
            metrics.append(metric)
        
        # Appointment lead time
        appointment_lead = ProviderMetricsService.calculate_appointment_lead_time(
            provider_firm, role_type, period_start, period_end
        )
        if appointment_lead['count'] > 0:
            metric, created = PerformanceMetric.objects.update_or_create(
                provider_firm=provider_firm,
                role_type=role_type,
                metric_type='appointment_lead_time',
                period_start=period_start.date(),
                period_end=period_end.date(),
                defaults={
                    'average_value': appointment_lead['average_value'],
                    'median_value': appointment_lead['median_value'],
                    'min_value': appointment_lead['min_value'],
                    'max_value': appointment_lead['max_value'],
                    'count': appointment_lead['count'],
                }
            )
            metrics.append(metric)
        
        return metrics
