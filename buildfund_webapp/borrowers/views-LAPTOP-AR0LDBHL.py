"""Views for borrower operations."""
from __future__ import annotations

import json
from django.utils import timezone
from rest_framework import mixins, permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import authenticate

from .models import BorrowerProfile
from .serializers import BorrowerProfileSerializer
from .company_service import CompanyDataProcessor


class IsOwner(permissions.BasePermission):
    """Custom permission to allow only owners of the profile to edit/view it."""

    def has_object_permission(self, request, view, obj) -> bool:
        return obj.user == request.user


class BorrowerProfileViewSet(
    mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    """ViewSet for borrowers to view, update or list their own profile.

    The list endpoint returns a single profile associated with the
    authenticated user.  Adding ListModelMixin makes it easy for
    front‑end applications to fetch the current profile without
    knowing its ID in advance.
    """

    serializer_class = BorrowerProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return BorrowerProfile.objects.filter(user=self.request.user)
    
    def get_object(self):
        """Return the borrower profile for the current user."""
        profile, _ = BorrowerProfile.objects.get_or_create(user=self.request.user)
        return profile

    def perform_update(self, serializer):
        profile = serializer.instance
        # Only allow updates if profile is not locked
        if not profile.can_edit():
            raise permissions.PermissionDenied(
                "Profile is locked for editing. Please wait for admin review or address requested changes."
            )
        serializer.save()
    
    @action(detail=False, methods=['get'])
    def status(self, request):
        """Get profile status and review information."""
        profile, _ = BorrowerProfile.objects.get_or_create(user=request.user)
        return Response({
            'status': profile.status,
            'can_edit': profile.can_edit(),
            'is_approved': profile.is_approved(),
            'submitted_at': profile.submitted_at.isoformat() if profile.submitted_at else None,
            'reviewed_at': profile.reviewed_at.isoformat() if profile.reviewed_at else None,
            'changes_requested': profile.changes_requested,
        })
    
    @action(detail=False, methods=['post'])
    def submit_for_review(self, request):
        """Submit borrower profile for admin review."""
        profile, _ = BorrowerProfile.objects.get_or_create(user=request.user)
        
        if not profile.can_edit():
            return Response(
                {'error': 'Profile cannot be submitted. Please address requested changes first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update profile with submitted data
        data = request.data
        
        # Step 1: Account setup and consent
        if 'step1' in data:
            step1 = data['step1']
            profile.mobile_number = step1.get('mobile_number', profile.mobile_number)
            profile.mfa_enabled = step1.get('mfa_enabled', False)
            profile.consent_privacy = step1.get('consent_privacy', False)
            profile.consent_privacy_timestamp = timezone.now() if step1.get('consent_privacy') else None
            profile.consent_terms = step1.get('consent_terms', False)
            profile.consent_terms_timestamp = timezone.now() if step1.get('consent_terms') else None
            profile.consent_credit_search = step1.get('consent_credit_search', False)
            profile.consent_credit_search_timestamp = timezone.now() if step1.get('consent_credit_search') else None
        
        # Step 2: Company verification
        if 'step2' in data:
            step2 = data['step2']
            # Only update company_data if it's provided and not empty/null
            # This prevents overwriting existing data with empty dict
            company_data = step2.get('company_data')
            if company_data is not None and company_data != {} and company_data != []:
                profile.company_data = company_data
            profile.company_verified_at = timezone.now() if step2.get('confirmed') else None
            profile.trading_address = step2.get('trading_address', profile.trading_address)
            profile.primary_contact_email = step2.get('primary_contact_email', profile.primary_contact_email)
            profile.primary_contact_phone = step2.get('primary_contact_phone', profile.primary_contact_phone)
            if step2.get('company_number'):
                profile.registration_number = step2['company_number']
            if step2.get('company_name'):
                profile.company_name = step2['company_name']
        
        # Step 3: Directors and shareholders
        if 'step3' in data:
            step3 = data['step3']
            profile.directors_data = step3.get('directors', [])
            profile.shareholders_data = step3.get('shareholders', [])
            profile.applicants_required = step3.get('applicants_required', [])
        
        # Step 4: Applicant personal details
        if 'step4' in data:
            step4 = data['step4']
            profile.applicants_data = step4.get('applicants', [])
        
        # Step 5: Financial snapshot
        if 'step5' in data:
            step5 = data['step5']
            profile.financial_mode = step5.get('mode', 'quick')
            profile.financial_data = {
                'income_total': step5.get('income_total'),
                'expenditure_total': step5.get('expenditure_total'),
                'assets_total': step5.get('assets_total'),
                'liabilities_total': step5.get('liabilities_total'),
                'income_breakdown': step5.get('income_breakdown', []),
                'expenditure_breakdown': step5.get('expenditure_breakdown', []),
                'assets_breakdown': step5.get('assets_breakdown', []),
                'liabilities_breakdown': step5.get('liabilities_breakdown', []),
            }
        
        # Step 6: Bank data
        if 'step6' in data:
            step6 = data['step6']
            profile.bank_data_method = step6.get('method', '')
            profile.open_banking_connected = step6.get('open_banking_connected', False)
            profile.open_banking_provider = step6.get('open_banking_provider', '')
            profile.open_banking_accounts = step6.get('accounts', [])
            profile.bank_statements = step6.get('pdf_statements', [])
            if step6.get('open_banking_connected'):
                profile.open_banking_consent_timestamp = timezone.now()
                profile.open_banking_last_sync = timezone.now()
        
        # Step 7: Documents
        if 'step7' in data:
            step7 = data['step7']
            profile.company_documents = step7.get('company_documents', {})
            profile.personal_documents = step7.get('personal_documents', {})
        
        # Update status
        profile.status = 'ready_for_review'
        profile.submitted_at = timezone.now()
        profile.save()
        
        return Response({
            'message': 'Profile submitted for review successfully',
            'status': profile.status,
        })
    
    @action(detail=False, methods=['post'])
    def connect_open_banking(self, request):
        """Connect Open Banking account."""
        profile, _ = BorrowerProfile.objects.get_or_create(user=request.user)
        
        provider = request.data.get('provider')
        if not provider:
            return Response(
                {'error': 'Provider is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # TODO: Integrate with actual Open Banking provider
        # For now, simulate connection
        profile.open_banking_connected = True
        profile.open_banking_provider = provider
        profile.open_banking_consent_timestamp = timezone.now()
        profile.open_banking_last_sync = timezone.now()
        profile.open_banking_accounts = [
            {
                'account_id': 'acc_123',
                'account_name': 'Business Account',
                'account_number': '****1234',
                'balance': 0,
            }
        ]
        profile.bank_data_method = 'open_banking'
        profile.save()
        
        return Response({
            'message': 'Open Banking connected successfully',
            'accounts': profile.open_banking_accounts,
        })
    
    @action(detail=False, methods=['post'])
    def documents_upload(self, request):
        """Upload documents securely."""
        profile, _ = BorrowerProfile.objects.get_or_create(user=request.user)
        
        files = request.FILES.getlist('files')
        document_type = request.data.get('document_type')
        category = request.data.get('category')  # 'company' or 'personal'
        
        if not files:
            return Response(
                {'error': 'No files provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file types and sizes
        allowed_types = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
        max_size = 10 * 1024 * 1024  # 10MB
        
        uploaded_documents = []
        for file in files:
            if file.content_type not in allowed_types:
                return Response(
                    {'error': f'Invalid file type: {file.content_type}. Allowed: PDF, JPG, PNG'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if file.size > max_size:
                return Response(
                    {'error': f'File {file.name} exceeds 10MB limit'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # TODO: Store file securely (encrypted, private storage)
            # For now, store metadata
            uploaded_documents.append({
                'file_name': file.name,
                'file_size': file.size,
                'file_type': file.content_type,
                'uploaded_at': timezone.now().isoformat(),
            })
        
        # Update profile documents
        if category == 'company':
            if document_type == 'statutory_accounts':
                if 'statutory_accounts' not in profile.company_documents:
                    profile.company_documents['statutory_accounts'] = []
                profile.company_documents['statutory_accounts'].extend(uploaded_documents)
            elif document_type == 'management_accounts':
                if 'management_accounts' not in profile.company_documents:
                    profile.company_documents['management_accounts'] = []
                profile.company_documents['management_accounts'].extend(uploaded_documents)
        elif category == 'personal':
            if document_type == 'photo_id':
                if 'photo_id' not in profile.personal_documents:
                    profile.personal_documents['photo_id'] = []
                profile.personal_documents['photo_id'].extend(uploaded_documents)
        elif category == 'bank':
            profile.bank_statements.extend(uploaded_documents)
        
        profile.save()
        
        return Response({
            'message': f'Successfully uploaded {len(uploaded_documents)} file(s)',
            'documents': uploaded_documents,
        })
    
    @action(detail=False, methods=['post'], url_path='save-company-document')
    def save_company_document(self, request):
        """Save a downloaded Companies House document to the borrower profile."""
        profile, _ = BorrowerProfile.objects.get_or_create(user=request.user)
        
        company_number = request.data.get('company_number')
        transaction_id = request.data.get('transaction_id')
        document_data = request.data.get('document_data')  # Base64 encoded
        filename = request.data.get('filename')
        content_type = request.data.get('content_type', 'application/pdf')
        document_type = request.data.get('document_type', 'other')
        description = request.data.get('description', 'Document from Companies House')
        
        if not company_number or not transaction_id or not document_data:
            return Response(
                {'error': 'company_number, transaction_id, and document_data are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            import base64
            from documents.models import Document, DocumentType
            
            # Decode base64 document data
            file_content = base64.b64decode(document_data)
            
            # Get or create document type
            doc_type, _ = DocumentType.objects.get_or_create(
                name=f"Companies House {document_type}",
                defaults={
                    'category': 'company',
                    'description': f'Document from Companies House: {description}',
                }
            )
            
            # Create Document record
            document = Document.objects.create(
                owner=request.user,
                file_name=filename or f"companies_house_{transaction_id}.pdf",
                file_size=len(file_content),
                file_type=content_type,
                upload_path=f"companies_house/{company_number}/{transaction_id}.pdf",
                description=description,
                document_type=doc_type,
                file_content=file_content,  # Store file content for small files
                validation_status='valid',  # Companies House documents are pre-validated
            )
            
            # Add to profile's documents
            profile.documents.add(document)
            
            # Also store metadata in company_documents JSON field
            if not profile.company_documents:
                profile.company_documents = {}
            
            doc_category = document_type.replace('_', ' ')
            if doc_category not in profile.company_documents:
                profile.company_documents[doc_category] = []
            
            profile.company_documents[doc_category].append({
                'document_id': document.id,
                'filename': filename,
                'transaction_id': transaction_id,
                'company_number': company_number,
                'description': description,
                'saved_at': timezone.now().isoformat(),
            })
            profile.save()
            
            return Response({
                'message': 'Document saved to profile successfully',
                'document_id': document.id,
                'filename': filename,
            })
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error saving company document: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to save document: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], url_path='verify-and-import-company')
    def verify_and_import_company(self, request):
        """
        Automatically verify company and import all data from Companies House.
        This is a lightweight, automated process that:
        - Verifies company information
        - Pulls in directors and shareholders
        - Automatically saves accounts documents
        - Summarizes charges
        """
        profile, _ = BorrowerProfile.objects.get_or_create(user=request.user)
        
        company_number = request.data.get('company_number')
        if not company_number:
            return Response(
                {'error': 'company_number is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            processor = CompanyDataProcessor()
            results = processor.process_and_save_company_data(profile, company_number)
            
            if results.get('errors'):
                return Response({
                    'message': 'Company data processed with some errors',
                    'results': results,
                }, status=status.HTTP_207_MULTI_STATUS)  # Multi-status for partial success
            
            return Response({
                'success': True,
                'message': 'Company data imported successfully',
                'results': {
                    'company_verified': True,
                    'directors_count': len(results.get('directors', [])),
                    'shareholders_count': len(results.get('shareholders', [])),
                    'accounts_documents_saved': len(results.get('accounts_documents', [])),
                    'charges_summary': results.get('charges_summary'),
                },
            })
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error importing company data: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to import company data: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )