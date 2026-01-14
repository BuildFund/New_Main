"""URL configuration for Deal Progression module."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    DealViewSet, DealPartyViewSet, DealTaskViewSet, DealCPViewSet,
    DealRequisitionViewSet, DrawdownViewSet, DealMessageThreadViewSet,
    DealMessageViewSet, LawFirmViewSet, LawFirmPanelMembershipViewSet
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
router.register(r'law-firms', LawFirmViewSet, basename='law-firm')
router.register(r'law-firm-panel', LawFirmPanelMembershipViewSet, basename='law-firm-panel')

urlpatterns = [
    path('', include(router.urls)),
]
