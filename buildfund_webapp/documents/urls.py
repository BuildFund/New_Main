"""URL configuration for documents."""
from __future__ import annotations

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import DocumentViewSet, DocumentTypeViewSet


router = DefaultRouter()
router.register(r"", DocumentViewSet, basename="document")
router.register(r"types", DocumentTypeViewSet, basename="document-type")

urlpatterns = [
    path("", include(router.urls)),
]