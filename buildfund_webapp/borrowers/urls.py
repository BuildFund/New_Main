"""URL configuration for borrowers."""
from __future__ import annotations

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import BorrowerProfileViewSet

router = DefaultRouter()
router.register(r"profiles", BorrowerProfileViewSet, basename="borrower-profile")

urlpatterns = [
    path("", include(router.urls)),
]