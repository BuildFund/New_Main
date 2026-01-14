"""Custom throttling classes for authentication endpoints."""
from __future__ import annotations

from django.conf import settings
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """
    Throttle for login/token endpoints to prevent brute force attacks.
    More restrictive than general anonymous throttling.
    In development, use lenient limits.
    """
    def get_rate(self):
        # Use lenient limits in development
        if settings.DEBUG:
            return '100/minute'  # Allow 100 login attempts per minute per IP in dev
        return '5/minute'  # Allow 5 login attempts per minute per IP in production


class TokenObtainThrottle(AnonRateThrottle):
    """
    Throttle for token obtain endpoint to prevent brute force attacks.
    In development, use lenient limits.
    """
    def get_rate(self):
        # Use lenient limits in development
        if settings.DEBUG:
            return '1000/hour'  # Allow 1000 token requests per hour per IP in dev
        return '10/hour'  # Allow 10 token requests per hour per IP in production


class VerificationThrottle(UserRateThrottle):
    """
    Throttle for verification endpoints to prevent API abuse.
    In development, use lenient limits.
    """
    def get_rate(self):
        # Use lenient limits in development
        if settings.DEBUG:
            return '1000/hour'  # Allow 1000 verification requests per hour per user in dev
        return '20/hour'  # Allow 20 verification requests per hour per user in production
