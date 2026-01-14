"""URL configuration for lenders."""
from __future__ import annotations

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import LenderProfileViewSet

router = DefaultRouter()
router.register(r"profiles", LenderProfileViewSet, basename="lender-profile")

urlpatterns = [
    path("", include(router.urls)),
]