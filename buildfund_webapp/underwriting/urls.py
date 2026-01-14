"""URL patterns for the underwriting app."""

from __future__ import annotations

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import UnderwritingReportViewSet


router = DefaultRouter()
router.register(r"reports", UnderwritingReportViewSet, basename="underwritingreport")

urlpatterns = [
    path("", include(router.urls)),
]
