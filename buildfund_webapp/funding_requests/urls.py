"""URL configuration for funding requests app."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FundingRequestViewSet

router = DefaultRouter()
router.register(r"", FundingRequestViewSet, basename="funding-request")

urlpatterns = [
    path("", include(router.urls)),
]
