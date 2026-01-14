"""API root view for BuildFund."""
from __future__ import annotations

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def api_root(request):
    """API root endpoint that returns available endpoints."""
    return Response({
        'name': 'BuildFund API',
        'version': '1.0',
        'status': 'operational',
        'endpoints': {
            'auth': '/api/auth/token/',
            'accounts': '/api/accounts/',
            'borrowers': '/api/borrowers/',
            'lenders': '/api/lenders/',
            'products': '/api/products/',
            'projects': '/api/projects/',
            'applications': '/api/applications/',
            'documents': '/api/documents/',
            'underwriting': '/api/underwriting/',
            'mapping': '/api/mapping/',
            'private-equity': '/api/private-equity/',
            'verification': '/api/verification/',
            'messaging': '/api/messaging/',
            'onboarding': '/api/onboarding/',
        }
    })
