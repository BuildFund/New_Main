"""URL configuration for Deal Progression module."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    DealViewSet, DealPartyViewSet, DealTaskViewSet, DealCPViewSet,
    DealRequisitionViewSet, DrawdownViewSet, DealMessageThreadViewSet,
    DealMessageViewSet, DealDocumentLinkViewSet, LawFirmViewSet, LawFirmPanelMembershipViewSet,
    ProviderEnquiryViewSet, ProviderQuoteViewSet, DealProviderSelectionViewSet,
    ProviderStageInstanceViewSet, ProviderDeliverableViewSet, ProviderAppointmentViewSet,
    ProviderMetricsViewSet
)

router = DefaultRouter()
router.register(r'deals', DealViewSet, basename='deal')
router.register(r'deal-parties', DealPartyViewSet, basename='deal-party')
router.register(r'deal-tasks', DealTaskViewSet, basename='deal-task')
router.register(r'deal-cps', DealCPViewSet, basename='deal-cp')
router.register(r'deal-requisitions', DealRequisitionViewSet, basename='deal-requisition')
router.register(r'drawdowns', DrawdownViewSet, basename='drawdown')
router.register(r'deal-message-threads', DealMessageThreadViewSet, basename='deal-message-thread')
router.register(r'deal-messages', DealMessageViewSet, basename='deal-message')
router.register(r'deal-documents', DealDocumentLinkViewSet, basename='deal-document')
router.register(r'law-firms', LawFirmViewSet, basename='law-firm')
router.register(r'law-firm-panel', LawFirmPanelMembershipViewSet, basename='law-firm-panel')
router.register(r'provider-enquiries', ProviderEnquiryViewSet, basename='provider-enquiry')
router.register(r'provider-quotes', ProviderQuoteViewSet, basename='provider-quote')
router.register(r'deal-provider-selections', DealProviderSelectionViewSet, basename='deal-provider-selection')
router.register(r'provider-stages', ProviderStageInstanceViewSet, basename='provider-stage')
router.register(r'provider-deliverables', ProviderDeliverableViewSet, basename='provider-deliverable')
router.register(r'provider-appointments', ProviderAppointmentViewSet, basename='provider-appointment')
router.register(r'provider-metrics', ProviderMetricsViewSet, basename='provider-metrics')

urlpatterns = [
    path('', include(router.urls)),
]
