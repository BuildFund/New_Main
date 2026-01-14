"""Views for FCA self-certification."""
from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction

from .certification_models import FCASelfCertification
from core.validators import validate_numeric_input, sanitize_string


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_certification_status(request):
    """Get current user's FCA certification status."""
    try:
        certification = FCASelfCertification.objects.get(user=request.user, is_active=True)
        return Response({
            "is_certified": True,
            "is_valid": certification.is_valid(),
            "certification": certification.get_certification_summary(),
        })
    except FCASelfCertification.DoesNotExist:
        return Response({
            "is_certified": False,
            "is_valid": False,
            "certification": None,
        })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def submit_certification(request):
    """Submit FCA self-certification."""
    user = request.user
    
    # Check if user already has an active certification
    existing = FCASelfCertification.objects.filter(user=user, is_active=True).first()
    if existing and existing.is_valid():
        return Response({
            "message": "You already have a valid certification",
            "certification": existing.get_certification_summary(),
        }, status=status.HTTP_200_OK)
    
    # Validate required fields
    required_fields = [
        "certification_type",
        "understands_risks",
        "understands_illiquidity",
        "can_afford_loss",
        "has_received_advice",
    ]
    
    for field in required_fields:
        if field not in request.data:
            return Response(
                {"error": f"Missing required field: {field}"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    certification_type = request.data.get("certification_type")
    if certification_type not in dict(FCASelfCertification.CERTIFICATION_TYPES):
        return Response(
            {"error": "Invalid certification type"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate boolean fields
    understands_risks = request.data.get("understands_risks", False)
    understands_illiquidity = request.data.get("understands_illiquidity", False)
    can_afford_loss = request.data.get("can_afford_loss", False)
    has_received_advice = request.data.get("has_received_advice", False)
    
    if not all([understands_risks, understands_illiquidity, can_afford_loss, has_received_advice]):
        return Response(
            {"error": "All required declarations must be confirmed"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Type-specific validations
    is_high_net_worth = request.data.get("is_high_net_worth", False)
    is_sophisticated = request.data.get("is_sophisticated", False)
    
    if certification_type == "high_net_worth" and not is_high_net_worth:
        return Response(
            {"error": "High net worth certification requires confirming high net worth status"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if certification_type in ["sophisticated", "certified"] and not is_sophisticated:
        return Response(
            {"error": "Sophisticated investor certification requires confirming sophisticated investor status"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate optional numeric fields
    annual_income = None
    if request.data.get("annual_income"):
        try:
            annual_income = validate_numeric_input(
                request.data.get("annual_income"),
                min_value=0,
                max_value=1000000000
            )
        except Exception as e:
            return Response(
                {"error": f"Invalid annual income: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    net_assets = None
    if request.data.get("net_assets"):
        try:
            net_assets = validate_numeric_input(
                request.data.get("net_assets"),
                min_value=0,
                max_value=1000000000
            )
        except Exception as e:
            return Response(
                {"error": f"Invalid net assets: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    investment_experience_years = None
    if request.data.get("investment_experience_years"):
        try:
            investment_experience_years = int(request.data.get("investment_experience_years"))
            if investment_experience_years < 0 or investment_experience_years > 100:
                raise ValueError("Investment experience must be between 0 and 100 years")
        except (ValueError, TypeError) as e:
            return Response(
                {"error": f"Invalid investment experience: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # Get client IP and user agent for compliance
    ip_address = request.META.get("REMOTE_ADDR")
    user_agent = request.META.get("HTTP_USER_AGENT", "")
    
    try:
        with transaction.atomic():
            # Deactivate any existing certifications
            FCASelfCertification.objects.filter(user=user, is_active=True).update(is_active=False)
            
            # Create new certification
            certification = FCASelfCertification.objects.create(
                user=user,
                certification_type=certification_type,
                is_high_net_worth=is_high_net_worth,
                is_sophisticated=is_sophisticated,
                understands_risks=understands_risks,
                understands_illiquidity=understands_illiquidity,
                can_afford_loss=can_afford_loss,
                has_received_advice=has_received_advice,
                annual_income=annual_income,
                net_assets=net_assets,
                investment_experience_years=investment_experience_years,
                ip_address=ip_address,
                user_agent=sanitize_string(user_agent, max_length=500),
            )
            
            return Response({
                "message": "Certification submitted successfully",
                "certification": certification.get_certification_summary(),
            }, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response(
            {"error": f"Failed to submit certification: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def check_certification(user) -> bool:
    """Check if user has valid FCA certification."""
    try:
        certification = FCASelfCertification.objects.get(user=user, is_active=True)
        return certification.is_valid()
    except FCASelfCertification.DoesNotExist:
        return False
