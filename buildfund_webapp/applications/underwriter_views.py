"""Views for Underwriter's Report."""
from __future__ import annotations

import traceback
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction

from core.throttles import PaidAPIThrottle
from .models import Application
from .models_underwriter import UnderwriterReport, UnderwriterReportAudit
from .underwriter_service import UnderwriterReportService
from .report_builder import ReportInputBuilder


class UnderwriterReportViewSet(viewsets.ViewSet):
    """ViewSet for managing Underwriter's Reports."""
    
    permission_classes = [permissions.IsAuthenticated]
    
    def _get_application(self, application_id):
        """Get application and check permissions."""
        try:
            application = Application.objects.get(id=application_id)
        except Application.DoesNotExist:
            return None, Response(
                {"error": "Application not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check permissions
        user = self.request.user
        can_access = (
            user.is_superuser or
            (hasattr(user, "lenderprofile") and application.lender == user.lenderprofile) or
            (hasattr(user, "borrowerprofile") and application.project.borrower == user.borrowerprofile)
        )
        
        if not can_access:
            return None, Response(
                {"error": "You do not have permission to access this report"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return application, None
    
    @action(detail=False, methods=["post"], url_path="generate/(?P<application_id>[^/.]+)", throttle_classes=[PaidAPIThrottle])
    def generate(self, request, application_id=None):
        """Generate or regenerate an underwriter's report (uses OpenAI - throttled)."""
        application, error_response = self._get_application(application_id)
        if error_response:
            return error_response
        
        user = request.user
        
        # Only admin can regenerate, or generate if not exists
        if not user.is_superuser:
            return Response(
                {"error": "Only administrators can generate reports"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        lender = application.lender
        
        # Check if report is locked
        latest_report = UnderwriterReport.get_latest_for_application_lender(application, lender)
        if latest_report and latest_report.is_locked:
            return Response(
                {"error": "Report is locked and cannot be regenerated"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Determine next version
        version = 1
        if latest_report:
            version = latest_report.version + 1
        
        # Create report record
        report = UnderwriterReport.objects.create(
            application=application,
            lender=lender,
            version=version,
            status='generating',
            created_by=user,
        )
        
        # Log generation start
        UnderwriterReportAudit.objects.create(
            report=report,
            user=user,
            action='generated',
            ip_address=self._get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
        )
        
        # Generate report asynchronously (in production, use Celery)
        try:
            service = UnderwriterReportService()
            result = service.generate_report(application, lender, user)
            
            # Update report
            report.report_json = result.get('report_json', {})
            report.plain_text_narrative = result.get('plain_text_narrative', '')
            report.status = result.get('status', 'ready')
            report.generation_error = result.get('error', '')
            report.save()
            
            # Log success
            UnderwriterReportAudit.objects.create(
                report=report,
                user=user,
                action='generated',
                ip_address=self._get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
            )
            
            return Response({
                'success': True,
                'report_id': report.id,
                'version': report.version,
                'status': report.status,
            })
            
        except Exception as e:
            report.status = 'failed'
            report.generation_error = str(e)
            report.save()
            
            return Response(
                {"error": f"Failed to generate report: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["get"], url_path="get/(?P<application_id>[^/.]+)")
    def get_report(self, request, application_id=None):
        """Get the latest underwriter's report for an application."""
        application, error_response = self._get_application(application_id)
        if error_response:
            return error_response
        
        user = request.user
        lender = application.lender
        
        # Borrower needs step-up authentication
        if hasattr(user, "borrowerprofile") and application.project.borrower == user.borrowerprofile:
            # Check step-up authentication (would be handled by frontend)
            # For now, allow access but frontend should require password
            pass
        
        # Get latest report
        report = UnderwriterReport.get_latest_for_application_lender(application, lender)
        
        if not report:
            return Response({
                'status': 'not_generated',
                'message': 'Report has not been generated yet',
            })
        
        # Log view
        UnderwriterReportAudit.objects.create(
            report=report,
            user=user,
            action='viewed',
            ip_address=self._get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
        )
        
        return Response({
            'id': report.id,
            'version': report.version,
            'status': report.status,
            'report_json': report.report_json,
            'plain_text_narrative': report.plain_text_narrative,
            'created_at': report.created_at.isoformat(),
            'is_locked': report.is_locked,
        })
    
    @action(detail=False, methods=["post"], url_path="lock/(?P<application_id>[^/.]+)")
    def lock_report(self, request, application_id=None):
        """Lock a report (admin only)."""
        application, error_response = self._get_application(application_id)
        if error_response:
            return error_response
        
        user = request.user
        
        if not user.is_superuser:
            return Response(
                {"error": "Only administrators can lock reports"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        lender = application.lender
        report = UnderwriterReport.get_latest_for_application_lender(application, lender)
        
        if not report:
            return Response(
                {"error": "Report not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        report.is_locked = True
        report.locked_by = user
        report.locked_at = timezone.now()
        report.save()
        
        # Log lock
        UnderwriterReportAudit.objects.create(
            report=report,
            user=user,
            action='locked',
            ip_address=self._get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
        )
        
        return Response({'success': True, 'message': 'Report locked'})
    
    @action(detail=False, methods=["get"], url_path="input-data/(?P<application_id>[^/.]+)")
    def get_input_data(self, request, application_id=None):
        """Get input data used for report generation (lenders and admins, with step-up auth for lenders)."""
        application, error_response = self._get_application(application_id)
        if error_response:
            return error_response
        
        user = request.user
        
        # Allow lenders and admins
        is_lender = hasattr(user, "lenderprofile") and application.lender == user.lenderprofile
        is_admin = user.is_superuser
        
        if not (is_lender or is_admin):
            return Response(
                {"error": "You do not have permission to view input data"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # For lenders, check step-up authentication
        if is_lender and not is_admin:
            session_key = request.headers.get('X-Step-Up-Session-Key') or request.query_params.get('session_key')
            if not session_key:
                return Response(
                    {"error": "Step-up authentication required", "requires_step_up": True},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            # Verify step-up session
            from borrowers.models_borrower_profile import StepUpAuthentication
            try:
                # Find the most recent valid step-up session for this user
                step_up = StepUpAuthentication.objects.filter(
                    user=user,
                    session_key=session_key
                ).order_by('-authenticated_at').first()
                
                if not step_up:
                    return Response(
                        {"error": "Invalid step-up session", "requires_step_up": True},
                        status=status.HTTP_401_UNAUTHORIZED
                    )
                
                if not step_up.is_valid():
                    return Response(
                        {"error": "Step-up session expired", "requires_step_up": True},
                        status=status.HTTP_401_UNAUTHORIZED
                    )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Error verifying step-up session: {e}", exc_info=True)
                return Response(
                    {"error": "Failed to verify step-up authentication", "requires_step_up": True},
                    status=status.HTTP_401_UNAUTHORIZED
                )
        
        try:
            builder = ReportInputBuilder(application)
            input_data = builder.build()
            
            return Response(input_data)
        except Exception as e:
            import traceback
            return Response(
                {"error": f"Failed to build input data: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _get_client_ip(self, request):
        """Get client IP address from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
