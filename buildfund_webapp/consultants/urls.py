"""URL configuration for consultants app."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ConsultantProfileViewSet,
    ConsultantServiceViewSet,
    ConsultantQuoteViewSet,
    ConsultantAppointmentViewSet,
)

router = DefaultRouter()
router.register(r"profiles", ConsultantProfileViewSet, basename="consultant-profile")
router.register(r"services", ConsultantServiceViewSet, basename="consultant-service")
router.register(r"quotes", ConsultantQuoteViewSet, basename="consultant-quote")
router.register(r"appointments", ConsultantAppointmentViewSet, basename="consultant-appointment")

urlpatterns = [
    path("", include(router.urls)),
]
