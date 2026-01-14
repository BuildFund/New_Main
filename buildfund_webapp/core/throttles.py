"""Custom throttle classes for paid API endpoints."""
from __future__ import annotations

from rest_framework.throttling import UserRateThrottle


class PaidAPIThrottle(UserRateThrottle):
    """
    Throttle class for paid/external API endpoints.
    Limits to 5 requests per minute to control costs.
    """
    rate = '5/minute'
    
    def get_cache_key(self, request, view):
        """Generate cache key based on user ID."""
        if request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }
