"""URL configuration for verification app."""
from __future__ import annotations

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CompanyVerificationViewSet, DirectorVerificationViewSet

router = DefaultRouter()
router.register(r"company", CompanyVerificationViewSet, basename="company-verification")
router.register(r"director", DirectorVerificationViewSet, basename="director-verification")

urlpatterns = [
    path("", include(router.urls)),
]
