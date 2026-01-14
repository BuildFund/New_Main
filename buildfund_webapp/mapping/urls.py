"""URL patterns for the mapping app."""

from django.urls import path

from .views import AutocompleteView, GeocodeView, ReverseGeocodeView, PostcodeLookupView


urlpatterns = [
    path("autocomplete/", AutocompleteView.as_view(), name="address-autocomplete"),
    path("geocode/", GeocodeView.as_view(), name="geocode"),
    path("reverse-geocode/", ReverseGeocodeView.as_view(), name="reverse-geocode"),
    path("postcode-lookup/", PostcodeLookupView.as_view(), name="postcode-lookup"),
]
