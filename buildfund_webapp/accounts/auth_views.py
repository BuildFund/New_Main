"""Custom authentication views."""
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import authenticate
from .throttles import TokenObtainThrottle, LoginRateThrottle


class CustomObtainAuthToken(ObtainAuthToken):
    """
    Token authentication endpoint that explicitly allows anonymous access.
    Protected by rate limiting to prevent brute force attacks.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [TokenObtainThrottle, LoginRateThrottle]


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def verify_password(request):
    """Verify user password for step-up authentication."""
    password = request.data.get('password')
    if not password:
        return Response(
            {'error': 'Password is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = authenticate(username=request.user.username, password=password)
    if user:
        return Response({'verified': True})
    else:
        return Response(
            {'verified': False, 'error': 'Incorrect password'},
            status=status.HTTP_401_UNAUTHORIZED
        )
