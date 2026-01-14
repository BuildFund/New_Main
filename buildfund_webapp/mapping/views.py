"""Mapping API views.

These endpoints proxy requests to Google Maps Platform services.  All
requests are made server‑side using the API key stored in
`settings.GOOGLE_API_KEY`.  Responses are returned directly to the
client.  Proper error handling ensures that missing API keys or
failed requests result in informative HTTP responses.
All inputs are validated and sanitized to prevent injection attacks.
"""

from __future__ import annotations

import requests
from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from core.validators import sanitize_string, validate_postcode


def call_google_api(endpoint: str, params: dict[str, str]) -> tuple[int, dict]:
    """Call a Google Maps endpoint with the configured API key.

    Returns a tuple of (status_code, response_json).
    """
    api_key = settings.GOOGLE_API_KEY
    if not api_key:
        return status.HTTP_500_INTERNAL_SERVER_ERROR, {
            "error": "GOOGLE_API_KEY is not configured on the server."
        }
    params = params.copy()
    params["key"] = api_key
    try:
        resp = requests.get(endpoint, params=params, timeout=5)
        data = resp.json()
        return resp.status_code, data
    except Exception as exc:
        return status.HTTP_502_BAD_GATEWAY, {"error": f"Failed to call Google API: {exc}"}


class AutocompleteView(APIView):
    """Provide address autocomplete suggestions using the Places API."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request) -> Response:
        query = request.query_params.get("query")
        if not query:
            return Response({"error": "query parameter is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Sanitize input to prevent injection
        try:
            query = sanitize_string(query, max_length=200)
        except Exception as e:
            return Response({"error": "Invalid query parameter"}, status=status.HTTP_400_BAD_REQUEST)
        
        endpoint = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
        status_code, data = call_google_api(endpoint, {"input": query})
        return Response(data, status=status_code)


class GeocodeView(APIView):
    """Geocode an address into latitude/longitude using the Geocoding API."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request) -> Response:
        address = request.query_params.get("address")
        if not address:
            return Response({"error": "address parameter is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Sanitize input to prevent injection
        try:
            address = sanitize_string(address, max_length=500)
        except Exception as e:
            return Response({"error": "Invalid address parameter"}, status=status.HTTP_400_BAD_REQUEST)
        
        endpoint = "https://maps.googleapis.com/maps/api/geocode/json"
        status_code, data = call_google_api(endpoint, {"address": address})
        return Response(data, status=status_code)


class ReverseGeocodeView(APIView):
    """Reverse geocode latitude/longitude into an address using the Geocoding API."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request) -> Response:
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        if not lat or not lng:
            return Response(
                {"error": "lat and lng parameters are required"}, status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate coordinates are numeric and within valid ranges
        try:
            from core.validators import validate_numeric_input
            lat = validate_numeric_input(lat, min_value=-90, max_value=90)
            lng = validate_numeric_input(lng, min_value=-180, max_value=180)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        endpoint = "https://maps.googleapis.com/maps/api/geocode/json"
        latlng = f"{lat},{lng}"
        status_code, data = call_google_api(endpoint, {"latlng": latlng})
        return Response(data, status=status_code)


class PostcodeLookupView(APIView):
    """Look up address details from a UK postcode using Google Geocoding API."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request) -> Response:
        postcode = request.query_params.get("postcode")
        if not postcode:
            return Response(
                {"error": "postcode parameter is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate and format postcode
        try:
            postcode_formatted = validate_postcode(postcode)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        # Add UK country restriction for better results
        address_query = f"{postcode_formatted}, UK"
        
        endpoint = "https://maps.googleapis.com/maps/api/geocode/json"
        status_code, data = call_google_api(endpoint, {"address": address_query})
        
        # Extract structured address components
        if status_code == 200 and data.get("status") == "OK" and data.get("results"):
            result = data["results"][0]
            address_components = {}
            
            for component in result.get("address_components", []):
                types = component.get("types", [])
                if "postal_town" in types or "locality" in types:
                    address_components["town"] = component.get("long_name")
                elif "administrative_area_level_2" in types:  # County
                    address_components["county"] = component.get("long_name")
                elif "postal_code" in types:
                    address_components["postcode"] = component.get("long_name")
                elif "country" in types:
                    address_components["country"] = component.get("long_name")
            
            # Add formatted address and location
            address_components["formatted_address"] = result.get("formatted_address")
            location = result.get("geometry", {}).get("location", {})
            address_components["location"] = {
                "lat": location.get("lat"),
                "lng": location.get("lng"),
            }
            
            data["address_components"] = address_components
        
        return Response(data, status=status_code)