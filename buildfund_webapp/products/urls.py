"""URL configuration for products."""
from __future__ import annotations

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ProductViewSet, FavouriteProductViewSet


router = DefaultRouter()
router.register(r"", ProductViewSet, basename="product")
router.register(r"favourites", FavouriteProductViewSet, basename="favourite-product")

urlpatterns = [
    path("", include(router.urls)),
]