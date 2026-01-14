"""Views for managing applications."""
from __future__ import annotations

from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from .models import Application, ApplicationStatusHistory, ApplicationDocument, ApplicationUnderwriting, UnderwriterReport, InformationRequest, InformationRequestItem
from .serializers import ApplicationSerializer, InformationRequestSerializer, InformationRequestCreateSerializer, InformationRequestItemSerializer
from .analysis import BorrowerAnalysisReport
from .underwriter_service import UnderwriterReportService
from documents.models import Document, DocumentType
from documents.services import DocumentValidationService, DocumentAIAssessmentService
from rest_framework.parsers import MultiPartParser, FormParser
from accounts.auth_views import verify_password


class ApplicationViewSet(viewsets.ModelViewSet):
    """ViewSet for creating and managing lender applications."""

    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        try:
            # Lenders see their own applications/enquiries; borrowers see applications/enquiries for their projects
            if hasattr(user, "lenderprofile"):
                return Application.objects.filter(lender=user.lenderprofile).select_related(
                    "project", "project__borrower", "project__borrower__user", "product", "lender", "lender__user"
                )
            if hasattr(user, "borrowerprofile"):
                return Application.objects.filter(project__borrower=user.borrowerprofile).select_related(
                    "project", "project__borrower", "project__borrower__user", "product", "lender", "lender__user"
                )
            # admins see all
            return Application.objects.all().select_related(
                "project", "project__borrower", "project__borrower__user", "product", "lender", "lender__user"
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in ApplicationViewSet.get_queryset: {e}", exc_info=True)
            # Return empty queryset on error
            return Application.objects.none()
    
    def list(self, request, *args, **kwargs):
        """List applications with error handling."""
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in ApplicationViewSet.list: {e}", exc_info=True)
            return Response(
                {"error": f"Failed to load applications: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def get_permissions(self):
        # For create: borrowers can create enquiries, lenders can create applications
        if self.action == "create":
            return [permissions.IsAuthenticated()]  # Both borrowers and lenders can create
        # For update/partial_update/destroy: only the lender that owns the application,
        # the borrower whose project it is, or an admin can modify it
        if self.action in {"update", "partial_update", "destroy"}:
            return [permissions.IsAuthenticated(), self.AdminOrOwnerOrBorrowerPermission()]
        return [permissions.IsAuthenticated()]

    class LenderPermission(permissions.BasePermission):
        """Allow access only to users with a lender profile."""

        def has_permission(self, request, view) -> bool:
            return hasattr(request.user, "lenderprofile")

    class AdminOrOwnerPermission(permissions.BasePermission):
        """Allow admin or the lender who owns the application."""

        def has_object_permission(self, request, view, obj) -> bool:
            return request.user.is_superuser or (
                hasattr(request.user, "lenderprofile") and obj.lender == request.user.lenderprofile
            )
    
    class AdminOrOwnerOrBorrowerPermission(permissions.BasePermission):
        """Allow admin, the lender who owns the application, or the borrower whose project it is."""

        def has_object_permission(self, request, view, obj) -> bool:
            if request.user.is_superuser:
                return True
            if hasattr(request.user, "lenderprofile") and obj.lender == request.user.lenderprofile:
                return True
            if hasattr(request.user, "borrowerprofile") and obj.project.borrower == request.user.borrowerprofile:
                return True
            return False
    
    @action(detail=True, methods=["get"])
    def analysis(self, request, pk=None):
        """Get AI-powered borrower analysis report for an application."""
        application = self.get_object()
        
        # Only lender who owns the application or admin can view analysis
        if not (request.user.is_superuser or 
                (hasattr(request.user, "lenderprofile") and application.lender == request.user.lenderprofile)):
            return Response(
                {"error": "You do not have permission to view this analysis"},
                status=403,
            )
        
        report = BorrowerAnalysisReport.generate_report(application)
        return Response(report)
    
    def perform_create(self, serializer):
        """Create application and send notification."""
        application = serializer.save()
        
        # Record initial status in history
        ApplicationStatusHistory.objects.create(
            application=application,
            status=application.status,
            feedback="",
            changed_by=self.request.user
        )
        
        # Send email notification to borrower
        try:
            from notifications.services import EmailNotificationService
            borrower_email = application.project.borrower.user.email
            if borrower_email:
                EmailNotificationService.notify_application_received(application, borrower_email)
        except Exception as e:
            print(f"Failed to send application notification email: {e}")
        
        return application
    
    def perform_update(self, serializer):
        """Update application and send notification if status changed."""
        old_status = self.get_object().status
        application = serializer.save()
        
        # Record status change in history
        if old_status != application.status:
            ApplicationStatusHistory.objects.create(
                application=application,
                status=application.status,
                feedback=application.status_feedback or "",
                changed_by=self.request.user
            )
            application.status_changed_at = timezone.now()
            application.save(update_fields=["status_changed_at"])
        
        # Send notification if status changed to accepted
        if old_status != "accepted" and application.status == "accepted":
            try:
                from notifications.services import EmailNotificationService
                lender_email = application.lender.user.email
                if lender_email:
                    EmailNotificationService.notify_application_accepted(application, lender_email)
            except Exception as e:
                print(f"Failed to send acceptance notification email: {e}")
            
            # Create Deal when application is accepted
            try:
                from deals.services import DealService
                deal = DealService.create_deal_from_application(application)
                # Log deal creation
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"Deal {deal.deal_id} created from application {application.id}")
            except Exception as e:
                # Log error but don't fail the status update
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to create deal on application acceptance: {e}", exc_info=True)
        
        return application
    
    @action(detail=True, methods=["post"])
    def update_status(self, request, pk=None):
        """
        Allow lenders to update application status with feedback.
        Only lenders who own the application or admins can update status.
        """
        application = self.get_object()
        
        # Check permissions
        user = request.user
        can_update = (
            user.is_superuser or
            (hasattr(user, "lenderprofile") and application.lender == user.lenderprofile)
        )
        
        if not can_update:
            return Response(
                {"error": "You do not have permission to update this application's status"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        new_status = request.data.get("status")
        feedback = request.data.get("status_feedback", "")
        
        if not new_status:
            return Response(
                {"error": "status field is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate status
        valid_statuses = [choice[0] for choice in Application.STATUS_CHOICES]
        if new_status not in valid_statuses:
            return Response(
                {"error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        old_status = application.status
        application.update_status(new_status, feedback)
        
        # Record in history
        ApplicationStatusHistory.objects.create(
            application=application,
            status=new_status,
            feedback=feedback,
            changed_by=user
        )
        
        # Generate underwriter report if status changed to "submitted"
        if old_status != 'submitted' and new_status == 'submitted':
            try:
                service = UnderwriterReportService()
                service.generate_report(application, created_by=None)  # System-generated
            except Exception as e:
                # Log error but don't fail the status update
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to generate underwriter report on submission: {e}", exc_info=True)
        
        # Send email notifications
        try:
            from notifications.services import EmailNotificationService
            borrower_email = application.project.borrower.user.email
            if borrower_email:
                # Notify borrower of status change
                EmailNotificationService.notify_application_status_changed(
                    application, borrower_email, old_status, new_status
                )
            
            # Notify lender if application is submitted
            if new_status == 'submitted':
                lender_email = application.lender.contact_email or application.lender.user.email
                if lender_email:
                    EmailNotificationService.notify_new_application_received(
                        application, lender_email
                    )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send notification email: {e}", exc_info=True)
        
        serializer = self.get_serializer(application)
        return Response(serializer.data)
    
    @action(detail=True, methods=["get"])
    def status_history(self, request, pk=None):
        """Get the status change history for an application."""
        application = self.get_object()
        
        # Check permissions - borrower, lender, or admin
        user = request.user
        can_view = (
            user.is_superuser or
            (hasattr(user, "lenderprofile") and application.lender == user.lenderprofile) or
            (hasattr(user, "borrowerprofile") and application.project.borrower == user.borrowerprofile)
        )
        
        if not can_view:
            return Response(
                {"error": "You do not have permission to view this application's status history"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        history = ApplicationStatusHistory.objects.filter(application=application)
        history_data = [
            {
                "status": h.status,
                "status_display": dict(Application.STATUS_CHOICES).get(h.status, h.status),
                "feedback": h.feedback,
                "changed_by": h.changed_by.username if h.changed_by else "System",
                "created_at": h.created_at.isoformat(),
            }
            for h in history
        ]
        
        return Response(history_data)
    
    @action(detail=True, methods=["get", "post"], parser_classes=[MultiPartParser, FormParser])
    def documents(self, request, pk=None):
        """Get or upload documents for an application."""
        application = self.get_object()
        
        # Check permissions - borrower, lender, or admin
        user = request.user
        can_access = (
            user.is_superuser or
            (hasattr(user, "lenderprofile") and application.lender == user.lenderprofile) or
            (hasattr(user, "borrowerprofile") and application.project.borrower == user.borrowerprofile)
        )
        
        if not can_access:
            return Response(
                {"error": "You do not have permission to access this application's documents"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if request.method == "GET":
            # List documents with validation and assessment info
            app_docs = ApplicationDocument.objects.filter(
                application=application
            ).select_related("document", "document__document_type", "uploaded_by").order_by("-uploaded_at")
            
            documents_data = [
                {
                    "id": ad.id,
                    "document_id": ad.document.id,
                    "file_name": ad.document.file_name,
                    "file_size": ad.document.file_size,
                    "file_type": ad.document.file_type,
                    "description": ad.description,
                    "uploaded_by": ad.uploaded_by.username if ad.uploaded_by else "Unknown",
                    "uploaded_at": ad.uploaded_at.isoformat(),
                    "document_type": ad.document.document_type.name if ad.document.document_type else None,
                    "document_category": ad.document.document_type.category if ad.document.document_type else None,
                    "validation_status": ad.document.validation_status,
                    "validation_score": ad.document.validation_score,
                    "validation_notes": ad.document.validation_notes,
                    "is_required": ad.is_required,
                }
                for ad in app_docs
            ]
            
            return Response(documents_data)
        
        elif request.method == "POST":
            # Upload new document with validation and AI assessment
            files = request.FILES.getlist("files")
            description = request.data.get("description", "")
            document_type_id = request.data.get("document_type_id")
            is_required = request.data.get("is_required", "false").lower() == "true"
            
            if not files:
                return Response(
                    {"error": "No files provided"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get document type if provided
            document_type = None
            if document_type_id:
                try:
                    document_type = DocumentType.objects.get(id=document_type_id)
                except DocumentType.DoesNotExist:
                    pass
            
            # Initialize services
            validation_service = DocumentValidationService()
            ai_service = DocumentAIAssessmentService()
            
            uploaded_docs = []
            for file in files:
                # Validate document
                validation_result = validation_service.validate_document(file, document_type)
                
                # Read file content for storage (for small files)
                file_content = None
                try:
                    if file.size <= 10 * 1024 * 1024:  # Only store files up to 10MB in database
                        file_content = file.read()
                        file.seek(0)  # Reset file pointer for potential re-reading
                except Exception as e:
                    print(f"Error reading file content: {e}")
                
                # Create document record
                document = Document.objects.create(
                    owner=user,
                    file_name=file.name,
                    file_size=file.size,
                    file_type=file.content_type or "application/octet-stream",
                    upload_path=f"applications/{application.id}/{file.name}",
                    description=description,
                    document_type=document_type,
                    validation_status="valid" if validation_result["valid"] else "invalid",
                    validation_score=validation_result["score"],
                    validation_notes=validation_result["notes"],
                    file_content=file_content,  # Store file content if available
                )
                
                # Perform AI assessment (async in production)
                try:
                    ai_assessment = ai_service.assess_document(document)
                    document.ai_assessment = ai_assessment
                    document.ai_assessed_at = timezone.now()
                    document.save()
                except Exception as e:
                    print(f"Error in AI assessment: {e}")
                    # Continue even if AI assessment fails
                
                # Link to application
                app_doc = ApplicationDocument.objects.create(
                    application=application,
                    document=document,
                    uploaded_by=user,
                    description=description,
                    is_required=is_required,
                )
                
                uploaded_docs.append({
                    "id": app_doc.id,
                    "document_id": document.id,
                    "file_name": document.file_name,
                    "file_size": document.file_size,
                    "file_type": document.file_type,
                    "description": app_doc.description,
                    "uploaded_by": user.username,
                    "uploaded_at": app_doc.uploaded_at.isoformat(),
                    "document_type": document.document_type.name if document.document_type else None,
                    "validation_status": document.validation_status,
                    "validation_score": document.validation_score,
                    "validation_notes": document.validation_notes,
                })
            
            # Trigger application assessment if documents uploaded
            if uploaded_docs:
                try:
                    self._assess_application(application)
                except Exception as e:
                    print(f"Error assessing application: {e}")
                    # Don't fail the upload if assessment fails
            
            return Response({
                "message": f"Successfully uploaded {len(uploaded_docs)} document(s)",
                "documents": uploaded_docs,
            }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=["get"], url_path="documents/(?P<doc_id>[^/.]+)/download")
    def download_document(self, request, pk=None, doc_id=None):
        """Download or view a document from an application."""
        from django.http import HttpResponse
        import base64
        
        application = self.get_object()
        
        # Check permissions - borrower, lender, or admin
        user = request.user
        can_access = (
            user.is_superuser or
            (hasattr(user, "lenderprofile") and application.lender == user.lenderprofile) or
            (hasattr(user, "borrowerprofile") and application.project.borrower == user.borrowerprofile)
        )
        
        if not can_access:
            return Response(
                {"error": "You do not have permission to access this document"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            app_doc = ApplicationDocument.objects.select_related("document").get(
                id=doc_id,
                application=application
            )
            document = app_doc.document
            
            # Check if document has file content
            if document.file_content:
                # Return file content
                response = HttpResponse(document.file_content, content_type=document.file_type)
                response['Content-Disposition'] = f'attachment; filename="{document.file_name}"'
                return response
            else:
                # If no file content, return document metadata with download link
                # In production, this would generate a pre-signed URL from S3
                return Response({
                    "error": "File content not available. Document may need to be re-uploaded.",
                    "document_id": document.id,
                    "file_name": document.file_name,
                    "file_type": document.file_type,
                    "file_size": document.file_size,
                }, status=status.HTTP_404_NOT_FOUND)
        except ApplicationDocument.DoesNotExist:
            return Response(
                {"error": "Document not found"},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=["get"], url_path="documents/(?P<doc_id>[^/.]+)/view")
    def view_document(self, request, pk=None, doc_id=None):
        """View a document inline (for PDFs, images, etc.)."""
        from django.http import HttpResponse
        import base64
        
        application = self.get_object()
        
        # Check permissions - borrower, lender, or admin
        user = request.user
        can_access = (
            user.is_superuser or
            (hasattr(user, "lenderprofile") and application.lender == user.lenderprofile) or
            (hasattr(user, "borrowerprofile") and application.project.borrower == user.borrowerprofile)
        )
        
        if not can_access:
            return Response(
                {"error": "You do not have permission to view this document"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            app_doc = ApplicationDocument.objects.select_related("document").get(
                id=doc_id,
                application=application
            )
            document = app_doc.document
            
            # Check if document has file content
            if document.file_content:
                # Return file content for inline viewing
                response = HttpResponse(document.file_content, content_type=document.file_type)
                response['Content-Disposition'] = f'inline; filename="{document.file_name}"'
                # Add CORS headers if needed
                response['Access-Control-Allow-Origin'] = '*'
                return response
            else:
                return Response({
                    "error": "File content not available. Document may need to be re-uploaded.",
                    "document_id": document.id,
                    "file_name": document.file_name,
                }, status=status.HTTP_404_NOT_FOUND)
        except ApplicationDocument.DoesNotExist:
            return Response(
                {"error": "Document not found"},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=["delete"], url_path="documents/(?P<doc_id>[^/.]+)")
    def delete_document(self, request, pk=None, doc_id=None):
        """Delete a document from an application."""
        application = self.get_object()
        
        # Check permissions
        user = request.user
        can_access = (
            user.is_superuser or
            (hasattr(user, "lenderprofile") and application.lender == user.lenderprofile) or
            (hasattr(user, "borrowerprofile") and application.project.borrower == user.borrowerprofile)
        )
        
        if not can_access:
            return Response(
                {"error": "You do not have permission to delete documents from this application"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            app_doc = ApplicationDocument.objects.get(id=doc_id, application=application)
            # Only allow deletion if user uploaded it or is admin
            if not (user.is_superuser or app_doc.uploaded_by == user):
                return Response(
                    {"error": "You can only delete documents you uploaded"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            document = app_doc.document
            app_doc.delete()
            document.delete()  # Also delete the document record
            
            return Response({"message": "Document deleted successfully"})
        except ApplicationDocument.DoesNotExist:
            return Response(
                {"error": "Document not found"},
                status=status.HTTP_404_NOT_FOUND
            )
    
    def _assess_application(self, application):
        """Assess application using AI based on all documents."""
        from documents.services import DocumentAIAssessmentService
        
        # Get all documents for this application
        app_docs = ApplicationDocument.objects.filter(
            application=application
        ).select_related("document")
        
        documents = [ad.document for ad in app_docs]
        
        # Perform AI assessment
        ai_service = DocumentAIAssessmentService()
        assessment_result = ai_service.assess_application(application, documents)
        
        # Create or update underwriting record
        underwriting, created = ApplicationUnderwriting.objects.get_or_create(
            application=application,
            defaults={
                "risk_score": assessment_result["risk_score"],
                "recommendation": assessment_result["recommendation"],
                "assessment_summary": assessment_result["summary"],
                "key_findings": assessment_result["key_findings"],
                "strengths": assessment_result["strengths"],
                "concerns": assessment_result["concerns"],
                "recommendations": assessment_result["recommendations"],
                "documents_analyzed": len(documents),
                "documents_valid": len([d for d in documents if d.validation_status == "valid"]),
                "documents_invalid": len([d for d in documents if d.validation_status == "invalid"]),
                "documents_pending": len([d for d in documents if d.validation_status == "pending"]),
                "assessment_data": assessment_result,
            }
        )
        
        if not created:
            # Update existing assessment
            underwriting.risk_score = assessment_result["risk_score"]
            underwriting.recommendation = assessment_result["recommendation"]
            underwriting.assessment_summary = assessment_result["summary"]
            underwriting.key_findings = assessment_result["key_findings"]
            underwriting.strengths = assessment_result["strengths"]
            underwriting.concerns = assessment_result["concerns"]
            underwriting.recommendations = assessment_result["recommendations"]
            underwriting.documents_analyzed = len(documents)
            underwriting.documents_valid = len([d for d in documents if d.validation_status == "valid"])
            underwriting.documents_invalid = len([d for d in documents if d.validation_status == "invalid"])
            underwriting.documents_pending = len([d for d in documents if d.validation_status == "pending"])
            underwriting.assessment_data = assessment_result
            underwriting.assessed_at = timezone.now()
            underwriting.save()
        
        return underwriting
    
    @action(detail=True, methods=["post"])
    def assess(self, request, pk=None):
        """Trigger AI assessment of application."""
        application = self.get_object()
        
        # Check permissions - only lender or admin
        user = request.user
        can_assess = (
            user.is_superuser or
            (hasattr(user, "lenderprofile") and application.lender == user.lenderprofile)
        )
        
        if not can_assess:
            return Response(
                {"error": "You do not have permission to assess this application"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            underwriting = self._assess_application(application)
            return Response({
                "message": "Application assessed successfully",
                "risk_score": underwriting.risk_score,
                "recommendation": underwriting.recommendation,
                "summary": underwriting.assessment_summary,
            })
        except Exception as e:
            return Response(
                {"error": f"Error assessing application: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=["get"])
    def underwriting(self, request, pk=None):
        """Get underwriting assessment for application."""
        application = self.get_object()
        
        # Check permissions
        user = request.user
        can_access = (
            user.is_superuser or
            (hasattr(user, "lenderprofile") and application.lender == user.lenderprofile) or
            (hasattr(user, "borrowerprofile") and application.project.borrower == user.borrowerprofile)
        )
        
        if not can_access:
            return Response(
                {"error": "You do not have permission to view underwriting assessment"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            underwriting = application.underwriting
            return Response({
                "risk_score": underwriting.risk_score,
                "recommendation": underwriting.recommendation,
                "summary": underwriting.assessment_summary,
                "key_findings": underwriting.key_findings,
                "strengths": underwriting.strengths,
                "concerns": underwriting.concerns,
                "recommendations": underwriting.recommendations,
                "documents_analyzed": underwriting.documents_analyzed,
                "documents_valid": underwriting.documents_valid,
                "documents_invalid": underwriting.documents_invalid,
                "assessed_at": underwriting.assessed_at.isoformat(),
            })
        except ApplicationUnderwriting.DoesNotExist:
            return Response({
                "message": "No underwriting assessment available yet",
                "risk_score": None,
            })
    
    @action(detail=True, methods=["post"])
    def give_consent(self, request, pk=None):
        """Borrower gives consent to share information with lender."""
        application = self.get_object()
        
        # Check permissions - only borrower can give consent
        user = request.user
        is_borrower = hasattr(user, "borrowerprofile") and application.project.borrower == user.borrowerprofile
        
        if not (user.is_superuser or is_borrower):
            return Response(
                {"error": "Only the borrower can give consent to share information"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        application.borrower_consent_given = True
        application.borrower_consent_given_at = timezone.now()
        application.borrower_consent_withdrawn_at = None
        application.save()
        
        return Response({
            "message": "Consent given successfully",
            "borrower_consent_given": True,
            "borrower_consent_given_at": application.borrower_consent_given_at.isoformat(),
        })
    
    @action(detail=True, methods=["post"])
    def withdraw_consent(self, request, pk=None):
        """Borrower withdraws consent to share information."""
        application = self.get_object()
        
        # Check permissions - only borrower can withdraw consent
        user = request.user
        is_borrower = hasattr(user, "borrowerprofile") and application.project.borrower == user.borrowerprofile
        
        if not (user.is_superuser or is_borrower):
            return Response(
                {"error": "Only the borrower can withdraw consent"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        application.borrower_consent_given = False
        application.borrower_consent_withdrawn_at = timezone.now()
        application.save()
        
        return Response({
            "message": "Consent withdrawn successfully",
            "borrower_consent_given": False,
        })
    
    @action(detail=True, methods=["get"])
    def borrower_information(self, request, pk=None):
        """Get comprehensive borrower information for lender (only if consent given and application accepted)."""
        application = self.get_object()
        
        # Check permissions - only lender can view borrower information
        user = request.user
        is_lender = hasattr(user, "lenderprofile") and application.lender == user.lenderprofile
        
        if not (user.is_superuser or is_lender):
            return Response(
                {"error": "Only the lender can view borrower information"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if application is accepted
        if application.status != "accepted":
            return Response(
                {"error": "Application must be accepted before viewing borrower information"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if borrower has given consent
        if not application.borrower_consent_given:
            return Response(
                {"error": "Borrower has not given consent to share information"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get borrower profile
        borrower_profile = application.project.borrower
        borrower_user = borrower_profile.user
        
        # Get onboarding data
        onboarding_data = None
        try:
            onboarding_data = borrower_user.onboarding_data
        except:
            pass
        
        # Get all documents for this application
        app_docs = ApplicationDocument.objects.filter(
            application=application
        ).select_related("document", "document__document_type")
        
        documents = [
            {
                "id": ad.document.id,
                "file_name": ad.document.file_name,
                "file_size": ad.document.file_size,
                "file_type": ad.document.file_type,
                "document_type": ad.document.document_type.name if ad.document.document_type else None,
                "document_category": ad.document.document_type.category if ad.document.document_type else None,
                "description": ad.description,
                "validation_status": ad.document.validation_status,
                "validation_score": ad.document.validation_score,
                "uploaded_at": ad.uploaded_at.isoformat(),
            }
            for ad in app_docs
        ]
        
        # Get borrower's other documents (from onboarding)
        borrower_documents = []
        if onboarding_data:
            borrower_documents = [
                {
                    "id": doc.id,
                    "file_name": doc.file_name,
                    "file_size": doc.file_size,
                    "file_type": doc.file_type,
                    "document_type": doc.document_type.name if doc.document_type else None,
                    "uploaded_at": doc.uploaded_at.isoformat(),
                }
                for doc in onboarding_data.documents_uploaded.all()
            ]
        
        # Compile comprehensive borrower information
        borrower_info = {
            # Personal Information
            "personal": {
                "first_name": borrower_profile.first_name,
                "last_name": borrower_profile.last_name,
                "date_of_birth": borrower_profile.date_of_birth.isoformat() if borrower_profile.date_of_birth else None,
                "email": borrower_user.email,
                "phone_number": borrower_profile.phone_number or (onboarding_data.phone_number if onboarding_data else None),
            },
            
            # Contact Information
            "contact": {
                "address_line_1": borrower_profile.address_1 or (onboarding_data.address_line_1 if onboarding_data else None),
                "address_line_2": borrower_profile.address_2 or (onboarding_data.address_line_2 if onboarding_data else None),
                "city": borrower_profile.city or (onboarding_data.town if onboarding_data else None),
                "county": borrower_profile.county or (onboarding_data.county if onboarding_data else None),
                "postcode": borrower_profile.postcode or (onboarding_data.postcode if onboarding_data else None),
                "country": borrower_profile.country or (onboarding_data.country if onboarding_data else "United Kingdom"),
            },
            
            # Company Information
            "company": {
                "company_name": borrower_profile.company_name or (onboarding_data.company_name if onboarding_data else None),
                "registration_number": borrower_profile.registration_number or (onboarding_data.company_registration_number if onboarding_data else None),
                "trading_name": borrower_profile.trading_name,
                "company_type": onboarding_data.company_type if onboarding_data else None,
                "company_status": onboarding_data.company_status if onboarding_data else None,
                "incorporation_date": onboarding_data.company_incorporation_date.isoformat() if onboarding_data and onboarding_data.company_incorporation_date else None,
            },
            
            # Financial Information
            "financial": {
                "annual_income": float(onboarding_data.annual_income) if onboarding_data and onboarding_data.annual_income else None,
                "employment_status": onboarding_data.employment_status if onboarding_data else None,
                "employment_company": onboarding_data.employment_company if onboarding_data else None,
                "employment_position": onboarding_data.employment_position if onboarding_data else None,
                "monthly_expenses": float(onboarding_data.monthly_expenses) if onboarding_data and onboarding_data.monthly_expenses else None,
                "existing_debts": float(onboarding_data.existing_debts) if onboarding_data and onboarding_data.existing_debts else None,
                "total_assets": float(onboarding_data.total_assets) if onboarding_data and onboarding_data.total_assets else None,
                "source_of_funds": onboarding_data.source_of_funds if onboarding_data else None,
            },
            
            # KYC Information
            "kyc": {
                "nationality": onboarding_data.nationality if onboarding_data else None,
                "national_insurance_number": onboarding_data.national_insurance_number if onboarding_data else None,
            },
            
            # Directors Information
            "directors": onboarding_data.directors_data if onboarding_data and onboarding_data.directors_data else [],
            
            # Documents
            "documents": {
                "application_documents": documents,
                "borrower_documents": borrower_documents,
            },
            
            # Project Information
            "project": {
                "project_reference": application.project.project_reference,
                "address": application.project.address,
                "town": application.project.town,
                "county": application.project.county,
                "postcode": application.project.postcode,
                "loan_amount_required": float(application.project.loan_amount_required),
                "property_type": application.project.property_type,
                "funding_type": application.project.funding_type,
            },
            
            # Application Details
            "application": {
                "loan_amount": float(application.proposed_loan_amount),
                "interest_rate": float(application.proposed_interest_rate) if application.proposed_interest_rate else None,
                "term_months": application.proposed_term_months,
                "ltv_ratio": float(application.proposed_ltv_ratio) if application.proposed_ltv_ratio else None,
            },
            
            # Underwriting Assessment
            "underwriting": None,
        }
        
        # Add underwriting if available
        try:
            underwriting = application.underwriting
            borrower_info["underwriting"] = {
                "risk_score": underwriting.risk_score,
                "recommendation": underwriting.recommendation,
                "summary": underwriting.assessment_summary,
                "key_findings": underwriting.key_findings,
                "strengths": underwriting.strengths,
                "concerns": underwriting.concerns,
                "recommendations": underwriting.recommendations,
            }
        except:
            pass
        
        return Response(borrower_info)
    
    @action(detail=True, methods=["get"], url_path="underwriter-report")
    def underwriter_report(self, request, pk=None):
        """Get the latest underwriter report for an application."""
        application = self.get_object()
        user = request.user
        
        # Check permissions
        is_lender = hasattr(user, "lenderprofile") and application.lender == user.lenderprofile
        is_borrower = hasattr(user, "borrowerprofile") and application.project.borrower == user.borrowerprofile
        is_admin = user.is_superuser
        
        if not (is_lender or is_borrower or is_admin):
            return Response(
                {"error": "You do not have permission to view this report"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # For borrowers, require step-up authentication
        if is_borrower:
            step_up_verified = request.session.get('step_up_auth_verified', False)
            if not step_up_verified:
                return Response(
                    {"error": "Step-up authentication required", "requires_step_up": True},
                    status=status.HTTP_401_UNAUTHORIZED
                )
        
        # For lenders, allow viewing if application is submitted to them (no status restriction)
        # The report will be generated automatically on submission, but lenders can view it anytime after
        
        # Get latest report
        try:
            report = UnderwriterReport.objects.filter(
                application=application,
                lender=application.lender
            ).order_by('-version').first()
            
            if not report:
                return Response({
                    "status": "not_generated",
                    "message": "Report has not been generated yet"
                })
            
            response_data = {
                "id": report.id,
                "version": report.version,
                "status": report.status,
                "is_locked": report.is_locked,
                "is_latest": report.is_latest,
                "report_json": report.report_json,
                "plain_text_narrative": report.plain_text_narrative,
                "generation_error": report.generation_error if report.status == 'failed' else None,
                "created_at": report.created_at.isoformat(),
                "created_by": report.created_by.email if report.created_by else "System",
            }
            
            # Include input data snapshot only for admins
            if user.is_superuser:
                response_data["input_data_snapshot"] = report.input_data_snapshot
            
            return Response(response_data)
        except Exception as e:
            return Response(
                {"error": f"Error retrieving report: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=["post"], url_path="generate-underwriter-report")
    def generate_underwriter_report(self, request, pk=None):
        """Generate or regenerate underwriter report (lenders and admins can generate)."""
        application = self.get_object()
        user = request.user
        
        # Check permissions
        is_lender = hasattr(user, "lenderprofile") and application.lender == user.lenderprofile
        is_admin = user.is_superuser
        
        if not (is_lender or is_admin):
            return Response(
                {"error": "Only lenders and administrators can generate reports"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if report is locked (only admins can regenerate locked reports)
        latest = UnderwriterReport.objects.filter(
            application=application,
            lender=application.lender
        ).order_by('-version').first()
        
        if latest and latest.is_locked and not is_admin:
            return Response(
                {"error": "Report is locked and cannot be regenerated"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            service = UnderwriterReportService()
            report = service.start_report_generation(application, created_by=user)
            
            return Response({
                "message": "Report generation started",
                "report_id": report.id,
                "version": report.version,
                "status": report.status,
            }, status=status.HTTP_202_ACCEPTED)
        except ValueError as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"ValueError generating underwriter report: {e}", exc_info=True)
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Exception generating underwriter report: {e}", exc_info=True)
            return Response(
                {"error": f"Error generating report: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=["post"], url_path="lock-underwriter-report")
    def lock_underwriter_report(self, request, pk=None):
        """Lock underwriter report (admin only)."""
        application = self.get_object()
        user = request.user
        
        if not user.is_superuser:
            return Response(
                {"error": "Only administrators can lock reports"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        latest = UnderwriterReport.objects.filter(
            application=application,
            lender=application.lender
        ).order_by('-version').first()
        
        if not latest:
            return Response(
                {"error": "No report found to lock"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        latest.is_locked = True
        latest.status = 'locked'
        latest.save()
        
        return Response({
            "message": "Report locked successfully",
            "report_id": latest.id,
        })
    
    @action(detail=True, methods=["get"], url_path="underwriter-report/versions")
    def underwriter_report_versions(self, request, pk=None):
        """Get version history of underwriter reports (admin only)."""
        application = self.get_object()
        user = request.user
        
        if not user.is_superuser:
            return Response(
                {"error": "Only administrators can view version history"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        reports = UnderwriterReport.objects.filter(
            application=application,
            lender=application.lender
        ).order_by('-version')
        
        return Response([
            {
                "id": r.id,
                "version": r.version,
                "status": r.status,
                "is_locked": r.is_locked,
                "created_at": r.created_at.isoformat(),
                "created_by": r.created_by.email if r.created_by else "System",
            }
            for r in reports
        ])
    
    @action(detail=True, methods=["post"], url_path="verify-step-up-auth")
    def verify_step_up_auth(self, request, pk=None):
        """Verify step-up authentication for viewing sensitive report data."""
        application = self.get_object()
        user = request.user
        
        # Only borrowers need step-up auth
        is_borrower = hasattr(user, "borrowerprofile") and application.project.borrower == user.borrowerprofile
        if not is_borrower:
            return Response(
                {"error": "Step-up authentication not required for this user"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        password = request.data.get('password')
        if not password:
            return Response(
                {"error": "Password is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify password
        from django.contrib.auth import authenticate
        authenticated_user = authenticate(username=user.username, password=password)
        
        if authenticated_user:
            request.session['step_up_auth_verified'] = True
            request.session['step_up_auth_timestamp'] = timezone.now().isoformat()
            return Response({"verified": True})
        else:
            return Response(
                {"verified": False, "error": "Incorrect password"},
                status=status.HTTP_401_UNAUTHORIZED
            )
    
    @action(detail=True, methods=["post"], url_path="accept")
    def accept_application(self, request, pk=None):
        """Accept an application and create a Deal."""
        application = self.get_object()
        user = request.user
        
        # Check lender permission
        # User must be a lender and the application must belong to their lender profile
        if not hasattr(user, "lenderprofile"):
            return Response(
                {"error": "Only lenders can accept applications"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if application.lender != user.lenderprofile and not user.is_superuser:
            return Response(
                {"error": f"You can only accept applications for your own lender profile. This application belongs to {application.lender.organisation_name}."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if already accepted
        if application.status == 'accepted':
            # Check if deal exists
            if hasattr(application, 'deal'):
                return Response({
                    "message": "Application already accepted",
                    "deal_id": application.deal.id,
                    "deal_deal_id": application.deal.deal_id,
                })
            else:
                return Response(
                    {"error": "Application is accepted but no deal found. Please contact support."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # Check if application is in a state that can be accepted
        if application.status not in ['approved', 'under_review', 'credit_check']:
            return Response(
                {"error": f"Application cannot be accepted from status: {application.status}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Explicitly create deal first (before updating status)
            # This ensures we can rollback if deal creation fails
            from deals.services import DealService
            deal = None
            try:
                deal = DealService.create_deal_from_application(application)
            except Exception as deal_error:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to create deal for application {application.id}: {deal_error}", exc_info=True)
                return Response(
                    {"error": f"Deal creation failed: {str(deal_error)}. Please contact support."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Verify deal was created and has deal_id
            if not deal or not deal.deal_id:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Deal created but missing deal_id for application {application.id}")
                return Response(
                    {"error": "Deal was created but is missing deal identifier. Please contact support."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Refresh application to ensure deal relationship is available
            # This prevents signal from trying to create duplicate deal
            application.refresh_from_db()
            
            # Now update application status to accepted
            # Use save() directly - signal will check if deal exists and skip creation
            application.status = 'accepted'
            application.status_feedback = request.data.get('notes', '')
            application.status_changed_at = timezone.now()
            application.save(update_fields=["status", "status_feedback", "status_changed_at", "updated_at"])
            
            # Refresh again to ensure relationship is loaded
            application.refresh_from_db()
            
            # Create audit event (non-critical - don't fail if this errors)
            try:
                from deals.models import AuditEvent
                AuditEvent.objects.create(
                    deal=deal,
                    event_type='deal_created',
                    actor_user=user,
                    metadata={
                        'description': f"Application {application.id} accepted by {user.username}",
                        'application_id': application.id,
                    }
                )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to create audit event (non-critical): {e}", exc_info=True)
            
            # Send notification to borrower (non-critical - don't fail if this errors)
            try:
                from notifications.services import EmailNotificationService
                borrower_email = application.project.borrower.user.email if application.project.borrower.user else None
                if borrower_email:
                    EmailNotificationService.notify_application_accepted(application, borrower_email)
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to send acceptance notification (non-critical): {e}", exc_info=True)
            
            # Always return success with deal info, even if non-critical operations failed
            return Response({
                "success": True,
                "message": "Application accepted successfully and deal created",
                "deal_id": deal.id,
                "deal_deal_id": deal.deal_id,
                "application_id": application.id,
                "redirect_url": f"/lender/deals/{deal.deal_id}",
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to accept application: {e}", exc_info=True)
            
            # If deal was created but something else failed, still return deal info
            if deal and deal.deal_id:
                return Response({
                    "success": True,
                    "message": "Application accepted and deal created (some operations may have failed)",
                    "deal_id": deal.id,
                    "deal_deal_id": deal.deal_id,
                    "application_id": application.id,
                    "redirect_url": f"/lender/deals/{deal.deal_id}",
                    "warning": f"Deal created but some operations failed: {str(e)}",
                }, status=status.HTTP_200_OK)
            
            return Response(
                {"error": f"Failed to accept application: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=["post"], url_path="decline")
    def decline_application(self, request, pk=None):
        """Decline an application with reason."""
        application = self.get_object()
        user = request.user
        
        # Check lender permission
        is_lender = hasattr(user, "lenderprofile") and application.lender == user.lenderprofile
        if not (is_lender or user.is_superuser):
            return Response(
                {"error": "Only lenders can decline applications"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if already declined or accepted
        if application.status == 'declined':
            return Response(
                {"message": "Application already declined"},
                status=status.HTTP_200_OK
            )
        
        if application.status == 'accepted':
            return Response(
                {"error": "Cannot decline an accepted application"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get decline reason
        reason_category = request.data.get('reason_category', '')
        notes = request.data.get('notes', '')
        
        if not reason_category:
            return Response(
                {"error": "Decline reason category is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Valid decline reason categories
        valid_categories = [
            'credit_risk',
            'insufficient_collateral',
            'property_valuation',
            'borrower_profile',
            'documentation',
            'other',
        ]
        
        if reason_category not in valid_categories:
            return Response(
                {"error": f"Invalid reason category. Must be one of: {', '.join(valid_categories)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Update application status to declined
            decline_feedback = f"Category: {reason_category}"
            if notes:
                decline_feedback += f"\nNotes: {notes}"
            
            application.update_status('declined', feedback=decline_feedback)
            
            # Store decline reason in status_feedback (or we could add a dedicated field)
            # For now, using status_feedback which already exists
            
            # Send notification to borrower (no sensitive details)
            try:
                from notifications.services import EmailNotificationService
                borrower_email = application.project.borrower.user.email if application.project.borrower.user else None
                if borrower_email:
                    # Create a generic notification without sensitive details
                    subject = f"Application Update: {application.product.name if application.product else 'Funding Application'}"
                    message = f"""
Your funding application has been declined.

Application Details:
- Application ID: {application.id}
- Lender: {application.lender.organisation_name}
- Product: {application.product.name if application.product else 'N/A'}

If you have any questions, please contact our support team.

Best regards,
BuildFund Team
                    """.strip()
                    
                    EmailNotificationService.send_email(
                        subject=subject,
                        message=message,
                        recipient_list=[borrower_email],
                    )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to send decline notification: {e}", exc_info=True)
            
            return Response({
                "message": "Application declined successfully",
                "application_id": application.id,
                "reason_category": reason_category,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to decline application: {e}", exc_info=True)
            return Response(
                {"error": f"Failed to decline application: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=["get", "post"], url_path="information-requests")
    def information_requests(self, request, pk=None):
        """List or create information requests for an application."""
        application = self.get_object()
        user = request.user
        
        # Check permissions - lender can create, borrower and lender can view
        is_lender = hasattr(user, "lenderprofile") and application.lender == user.lenderprofile
        is_borrower = hasattr(user, "borrowerprofile") and application.project.borrower == user.borrowerprofile
        
        if request.method == 'GET':
            # Both lender and borrower can view requests
            if not (is_lender or is_borrower or user.is_superuser):
                return Response(
                    {"error": "You do not have permission to view information requests"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            requests = InformationRequest.objects.filter(application=application).prefetch_related('items')
            serializer = InformationRequestSerializer(requests, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            # Only lender can create requests
            if not (is_lender or user.is_superuser):
                return Response(
                    {"error": "Only lenders can create information requests"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            create_serializer = InformationRequestCreateSerializer(
                data=request.data,
                context={'application': application, 'request': request}
            )
            if create_serializer.is_valid():
                request_obj = create_serializer.save()
                
                # Send notification to borrower
                try:
                    from notifications.services import EmailNotificationService
                    borrower_email = application.project.borrower.user.email if application.project.borrower.user else None
                    if borrower_email:
                        EmailNotificationService.notify_information_request_created(request_obj, borrower_email)
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Failed to send information request notification: {e}", exc_info=True)
                
                serializer = InformationRequestSerializer(request_obj)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(create_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=["post"], url_path="information-requests/(?P<request_id>[^/.]+)/items/(?P<item_id>[^/.]+)/upload")
    def upload_item_document(self, request, pk=None, request_id=None, item_id=None):
        """Borrower uploads a document for an information request item."""
        application = self.get_object()
        user = request.user
        
        # Check borrower permission
        is_borrower = hasattr(user, "borrowerprofile") and application.project.borrower == user.borrowerprofile
        if not (is_borrower or user.is_superuser):
            return Response(
                {"error": "Only borrowers can upload documents for information requests"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            info_request = InformationRequest.objects.get(id=request_id, application=application)
            item = InformationRequestItem.objects.get(id=item_id, request=info_request)
        except (InformationRequest.DoesNotExist, InformationRequestItem.DoesNotExist):
            return Response(
                {"error": "Information request or item not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Handle file upload
        if 'file' not in request.FILES:
            return Response(
                {"error": "No file provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file = request.FILES['file']
        
        # Create document using existing secure upload system
        from documents.models import Document
        from documents.services import DocumentValidationService
        
        document = Document.objects.create(
            file=file,
            file_name=file.name,
            uploaded_by=user,
            document_type=item.document_type,
        )
        
        # Link document to item
        item.uploaded_document = document
        item.status = 'uploaded'
        item.save()
        
        # Send notification to lender
        try:
            from notifications.services import EmailNotificationService
            lender_email = application.lender.user.email if application.lender.user else None
            if lender_email:
                EmailNotificationService.notify_information_item_uploaded(item, lender_email)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send upload notification: {e}", exc_info=True)
        
        serializer = InformationRequestItemSerializer(item)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=["post"], url_path="information-requests/(?P<request_id>[^/.]+)/items/(?P<item_id>[^/.]+)/review")
    def review_item(self, request, pk=None, request_id=None, item_id=None):
        """Lender accepts or rejects an information request item."""
        application = self.get_object()
        user = request.user
        
        # Check lender permission
        is_lender = hasattr(user, "lenderprofile") and application.lender == user.lenderprofile
        if not (is_lender or user.is_superuser):
            return Response(
                {"error": "Only lenders can review information request items"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            info_request = InformationRequest.objects.get(id=request_id, application=application)
            item = InformationRequestItem.objects.get(id=item_id, request=info_request)
        except (InformationRequest.DoesNotExist, InformationRequestItem.DoesNotExist):
            return Response(
                {"error": "Information request or item not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        action = request.data.get('action')  # 'accept' or 'reject'
        comment = request.data.get('comment', '')
        
        if action not in ['accept', 'reject']:
            return Response(
                {"error": "Action must be 'accept' or 'reject'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if action == 'accept':
            item.status = 'accepted'
        elif action == 'reject':
            item.status = 'rejected'
            item.rework_count += 1
            # Reset uploaded document to allow re-upload
            item.uploaded_document = None
        
        item.lender_comment = comment
        item.reviewed_by = user
        item.reviewed_at = timezone.now()
        item.save()
        
        # Send notification to borrower
        try:
            from notifications.services import EmailNotificationService
            borrower_email = application.project.borrower.user.email if application.project.borrower.user else None
            if borrower_email:
                EmailNotificationService.notify_information_item_reviewed(item, borrower_email, action)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send review notification: {e}", exc_info=True)
        
        serializer = InformationRequestItemSerializer(item)
        return Response(serializer.data, status=status.HTTP_200_OK)