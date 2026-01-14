"""URL configuration for messaging app."""
from __future__ import annotations

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MessageViewSet, MessageAttachmentViewSet

router = DefaultRouter()
router.register(r"messages", MessageViewSet, basename="message")
router.register(r"attachments", MessageAttachmentViewSet, basename="message-attachment")

urlpatterns = [
    path("", include(router.urls)),
]
