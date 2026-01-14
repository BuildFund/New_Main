"""URL configuration for the private equity module."""

from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PrivateEquityOpportunityViewSet, PrivateEquityInvestmentViewSet
from .certification_views import get_certification_status, submit_certification

router = DefaultRouter()
router.register(r"opportunities", PrivateEquityOpportunityViewSet, basename="pe-opportunity")
router.register(r"investments", PrivateEquityInvestmentViewSet, basename="pe-investment")

urlpatterns = [
    path("", include(router.urls)),
    path("certification/status/", get_certification_status, name="fca-certification-status"),
    path("certification/submit/", submit_certification, name="fca-certification-submit"),
]