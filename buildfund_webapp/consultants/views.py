"""Views for consultants app."""
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Q
from django.utils import timezone

from .models import ConsultantProfile, ConsultantService, ConsultantQuote, ConsultantAppointment
from .serializers import (
    ConsultantProfileSerializer,
    ConsultantServiceSerializer,
    ConsultantQuoteSerializer,
    ConsultantAppointmentSerializer,
)
from .services import ConsultantMatchingService


class ConsultantProfileViewSet(viewsets.ModelViewSet):
    """ViewSet for consultant profiles."""
    
    serializer_class = ConsultantProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        service_type = self.request.query_params.get('service_type')
        
        # For lender inviting consultants, show all active verified consultants
        if hasattr(user, 'lenderprofile') or user.is_staff:
            qs = ConsultantProfile.objects.filter(is_active=True, is_verified=True)
            if service_type:
                # Filter by service type (valuer, monitoring_surveyor, solicitor)
                service_map = {
                    'valuer': 'valuation',
                    'monitoring_surveyor': 'monitoring_surveyor',
                    'solicitor': 'solicitor',
                }
                mapped_type = service_map.get(service_type, service_type)
                qs = qs.filter(services_offered__contains=[mapped_type])
            return qs
        
        # Consultants see their own profile
        if hasattr(user, "consultantprofile"):
            return ConsultantProfile.objects.filter(user=user)
        
        return ConsultantProfile.objects.none()
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['post'], url_path='verify-and-import-company')
    def verify_and_import_company(self, request):
        """
        Verify company and import basic company information from Companies House.
        """
        from verification.services import HMRCVerificationService
        
        profile, _ = ConsultantProfile.objects.get_or_create(user=request.user)
        
        company_number = request.data.get('company_number')
        if not company_number:
            return Response(
                {'error': 'company_number is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            hmrc_service = HMRCVerificationService()
            company_info = hmrc_service.get_company_info(company_number)
            
            if "error" in company_info:
                return Response(
                    {'error': company_info.get('error')},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update profile with company data
            profile.company_registration_number = company_number
            profile.organisation_name = company_info.get('company_name', profile.organisation_name)
            
            # Store company data in a JSON field if needed (similar to borrowers)
            # For now, just save the basic info
            profile.save()
            
            return Response({
                'message': 'Company verified successfully',
                'company_name': company_info.get('company_name'),
                'company_number': company_number,
                'company_status': company_info.get('company_status'),
                'date_of_creation': company_info.get('date_of_creation'),
            })
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error verifying company: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to verify company: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ConsultantServiceViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing consultant service requests."""
    
    serializer_class = ConsultantServiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        # Consultants see services they can quote on
        # Borrowers/Lenders see services for their applications
        if hasattr(user, "consultantprofile"):
            consultant = user.consultantprofile
            # Filter by consultant's services_offered
            qs = ConsultantService.objects.filter(status__in=["pending", "quotes_received"])
            
            # Filter by service type - consultant must offer at least one matching service
            service_types = consultant.services_offered or []
            if service_types:
                # Build Q query for any matching service type
                from django.db.models import Q
                service_filter = Q()
                for service_type in service_types:
                    service_filter |= Q(service_type=service_type)
                qs = qs.filter(service_filter)
            
            # Filter by geographic coverage if consultant has specific coverage
            if consultant.geographic_coverage:
                # Consultant covers specific regions - filter services that match or have no geographic requirement
                geographic_filter = Q(geographic_requirement__in=consultant.geographic_coverage) | Q(geographic_requirement="")
                qs = qs.filter(geographic_filter)
            
            return qs
        elif hasattr(user, "borrowerprofile"):
            return ConsultantService.objects.filter(
                application__project__borrower=user.borrowerprofile
            )
        elif hasattr(user, "lenderprofile"):
            return ConsultantService.objects.filter(
                application__lender=user.lenderprofile
            )
        elif user.is_staff:
            return ConsultantService.objects.all()
        return ConsultantService.objects.none()
    
    @action(detail=True, methods=["get"])
    def matching_consultants(self, request, pk=None):
        """Get list of matching consultants for this service."""
        service = self.get_object()
        matching_service = ConsultantMatchingService()
        consultants = matching_service.find_matching_consultants(service, limit=20)
        
        # Calculate match scores
        results = []
        for consultant in consultants:
            score = matching_service.calculate_match_score(consultant, service)
            results.append({
                "consultant": ConsultantProfileSerializer(consultant).data,
                "match_score": score,
            })
        
        return Response({"matching_consultants": results})


class ConsultantQuoteViewSet(viewsets.ModelViewSet):
    """ViewSet for consultant quotes."""
    
    serializer_class = ConsultantQuoteSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "consultantprofile"):
            # Consultants see their own quotes
            return ConsultantQuote.objects.filter(consultant=user.consultantprofile)
        elif hasattr(user, "borrowerprofile"):
            # Borrowers see quotes for their applications
            return ConsultantQuote.objects.filter(
                service__application__project__borrower=user.borrowerprofile
            )
        elif hasattr(user, "lenderprofile"):
            # Lenders see quotes for their applications
            return ConsultantQuote.objects.filter(
                service__application__lender=user.lenderprofile
            )
        elif user.is_staff:
            return ConsultantQuote.objects.all()
        return ConsultantQuote.objects.none()
    
    def perform_create(self, serializer):
        consultant = self.request.user.consultantprofile
        serializer.save(consultant=consultant, status="submitted")
        
        # Update service status if first quote
        service = serializer.validated_data["service"]
        if service.status == "pending":
            service.status = "quotes_received"
            service.save()
    
    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        """Accept a quote (borrower/lender action)."""
        quote = self.get_object()
        user = request.user
        
        # Check permissions
        application = quote.service.application
        is_borrower = hasattr(user, "borrowerprofile") and application.project.borrower == user.borrowerprofile
        is_lender = hasattr(user, "lenderprofile") and application.lender == user.lenderprofile
        
        if not (is_borrower or is_lender or user.is_staff):
            return Response(
                {"error": "You do not have permission to accept this quote."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if another quote is already accepted
        if ConsultantAppointment.objects.filter(service=quote.service).exists():
            return Response(
                {"error": "A consultant has already been appointed for this service."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create appointment
        appointment = ConsultantAppointment.objects.create(
            consultant=quote.consultant,
            service=quote.service,
            quote=quote,
            status="appointed",
        )
        
        # Update quote status
        quote.status = "accepted"
        quote.accepted_at = timezone.now()
        quote.save()
        
        # Update service status
        quote.service.status = "consultant_selected"
        quote.service.save()
        
        # Update consultant capacity
        consultant = quote.consultant
        consultant.current_capacity += 1
        consultant.save()
        
        return Response({
            "message": "Quote accepted and consultant appointed.",
            "appointment": ConsultantAppointmentSerializer(appointment).data,
        })


class ConsultantAppointmentViewSet(viewsets.ModelViewSet):
    """ViewSet for consultant appointments."""
    
    serializer_class = ConsultantAppointmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "consultantprofile"):
            return ConsultantAppointment.objects.filter(consultant=user.consultantprofile)
        elif hasattr(user, "borrowerprofile"):
            return ConsultantAppointment.objects.filter(
                service__application__project__borrower=user.borrowerprofile
            )
        elif hasattr(user, "lenderprofile"):
            return ConsultantAppointment.objects.filter(
                service__application__lender=user.lenderprofile
            )
        elif user.is_staff:
            return ConsultantAppointment.objects.all()
        return ConsultantAppointment.objects.none()
    
    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser], url_path="upload-documents")
    def upload_documents(self, request, pk=None):
        """Upload a document to the appointment."""
        from documents.models import Document
        
        appointment = self.get_object()
        
        # Check permissions - only consultant can upload
        if not hasattr(request.user, "consultantprofile") or appointment.consultant != request.user.consultantprofile:
            return Response(
                {"error": "Only the appointed consultant can upload documents."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        files = request.FILES.getlist('files')
        if not files:
            return Response(
                {"error": "No files provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uploaded_documents = []
        for file in files:
            # Create document using the Document model
            document = Document.objects.create(
                owner=request.user,
                file_name=file.name,
                file_size=file.size,
                file_type=file.content_type or "application/octet-stream",
                upload_path=f"consultant_appointments/{appointment.id}/{file.name}",
                description=f"Document uploaded by {appointment.consultant.organisation_name} for {appointment.service.get_service_type_display()}",
            )
            appointment.documents.add(document)
            uploaded_documents.append({
                "id": document.id,
                "name": document.file_name,
                "file_name": document.file_name,
                "file_type": document.file_type,
                "file_url": None,  # Will be populated by serializer
                "url": None,
            })
        
        return Response({
            "message": f"Successfully uploaded {len(uploaded_documents)} document(s)",
            "documents": uploaded_documents,
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=["post"])
    def add_progress_note(self, request, pk=None):
        """Add a progress note to the appointment."""
        appointment = self.get_object()
        
        # Check permissions
        if not hasattr(request.user, "consultantprofile") or appointment.consultant != request.user.consultantprofile:
            return Response(
                {"error": "Only the appointed consultant can add progress notes."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        note_text = request.data.get("note", "").strip()
        if not note_text:
            return Response(
                {"error": "Note text is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        progress_notes = appointment.progress_notes or []
        progress_notes.append({
            "note": note_text,
            "timestamp": timezone.now().isoformat(),
            "user": request.user.username,
        })
        appointment.progress_notes = progress_notes
        appointment.save()
        
        return Response({
            "message": "Progress note added successfully",
            "progress_notes": progress_notes,
        })
    
    @action(detail=True, methods=["post"])
    def update_status(self, request, pk=None):
        """Update appointment status."""
        appointment = self.get_object()
        new_status = request.data.get("status")
        
        if new_status not in [choice[0] for choice in ConsultantAppointment.STATUS_CHOICES]:
            return Response(
                {"error": "Invalid status"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check permissions
        is_consultant = hasattr(request.user, "consultantprofile") and appointment.consultant == request.user.consultantprofile
        is_borrower = hasattr(request.user, "borrowerprofile") and appointment.service.application.project.borrower == request.user.borrowerprofile
        is_lender = hasattr(request.user, "lenderprofile") and appointment.service.application.lender == request.user.lenderprofile
        
        if not (is_consultant or is_borrower or is_lender or request.user.is_staff):
            return Response(
                {"error": "You do not have permission to update this appointment."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        appointment.status = new_status
        
        if new_status == "in_progress" and not appointment.start_date:
            appointment.start_date = timezone.now().date()
        
        if new_status == "completed" and not appointment.actual_completion_date:
            appointment.actual_completion_date = timezone.now().date()
            # Reduce consultant capacity
            appointment.consultant.current_capacity = max(0, appointment.consultant.current_capacity - 1)
            appointment.consultant.save()
        
        appointment.save()
        
        return Response({
            "message": "Status updated successfully",
            "appointment": ConsultantAppointmentSerializer(appointment).data,
        })
