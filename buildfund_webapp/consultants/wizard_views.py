"""Views for Consultant/Solicitor Profile Wizard."""
from __future__ import annotations

import traceback
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction

from .models import ConsultantProfile
from .models_wizard import ConsultantCompanyData
from borrowers.services import CompaniesHouseService


class ConsultantProfileWizardViewSet(viewsets.ViewSet):
    """ViewSet for Consultant/Solicitor Profile Wizard (lighter touch)."""
    
    permission_classes = [permissions.IsAuthenticated]
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._companies_house_service = None
    
    @property
    def companies_house_service(self):
        """Lazy initialization of Companies House service."""
        if self._companies_house_service is None:
            try:
                self._companies_house_service = CompaniesHouseService()
            except ValueError as e:
                print(f"Warning: CompaniesHouseService not available: {e}")
                self._companies_house_service = None
        return self._companies_house_service
    
    def _get_consultant_profile(self, user):
        """Get or create consultant profile for user."""
        profile, _ = ConsultantProfile.objects.get_or_create(user=user)
        return profile
    
    @action(detail=False, methods=["get"])
    def status(self, request):
        """Get current wizard status and progress."""
        try:
            profile = self._get_consultant_profile(request.user)
            progress = profile.get_wizard_progress()
            
            return Response({
                'wizard_status': profile.wizard_status,
                'current_step': profile.current_wizard_step,
                'completed_steps': profile.completed_steps,
                'progress_percentage': progress,
                'is_complete': profile.is_wizard_complete(),
                'steps': profile.WIZARD_STEPS,
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to get wizard status: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def save_step(self, request):
        """Save data for a wizard step."""
        try:
            profile = self._get_consultant_profile(request.user)
            step = request.data.get('step')
            data = request.data.get('data', {})
            
            if not step:
                return Response(
                    {'error': 'step is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if step not in profile.WIZARD_STEPS:
                return Response(
                    {'error': f'Invalid step: {step}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update wizard data
            if not profile.wizard_data:
                profile.wizard_data = {}
            profile.wizard_data[step] = data
            
            # If this is the role_services step, update the profile fields directly
            if step == 'role_services':
                if 'primary_service' in data:
                    profile.primary_service = data['primary_service']
                if 'services_offered' in data:
                    profile.services_offered = data['services_offered']
            
            # Update current step
            if step not in profile.completed_steps:
                profile.completed_steps.append(step)
            profile.current_wizard_step = step
            
            if profile.wizard_status == 'not_started':
                profile.wizard_status = 'in_progress'
            
            profile.save()
            
            return Response({
                'success': True,
                'progress_percentage': profile.get_wizard_progress(),
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to save step: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def search_company(self, request):
        """Search Companies House for company."""
        try:
            if not self.companies_house_service:
                return Response(
                    {'error': 'Companies House service not available'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            
            query = request.data.get('query', '').strip()
            if not query:
                return Response(
                    {'error': 'query is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            results = self.companies_house_service.search_company(query)
            
            return Response({
                'results': results,
                'count': len(results),
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to search company: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def import_company(self, request):
        """Import company data from Companies House."""
        try:
            if not self.companies_house_service:
                return Response(
                    {'error': 'Companies House service not available'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            
            company_number = request.data.get('company_number', '').strip()
            if not company_number:
                return Response(
                    {'error': 'company_number is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            profile = self._get_consultant_profile(request.user)
            
            # Use enhanced import_company_data to get all information
            company_data = self.companies_house_service.import_company_data(
                company_number, 
                include_documents=True
            )
            
            company_profile = company_data.get('profile', {})
            officers = company_data.get('officers', [])
            psc = company_data.get('psc', [])
            accounts = company_data.get('accounts', [])
            statements = company_data.get('confirmation_statements', [])
            incorporation_cert = company_data.get('incorporation_certificate')
            charges = company_data.get('charges', [])
            
            # Parse date_of_creation
            incorporation_date = None
            date_of_creation = company_profile.get('date_of_creation')
            if date_of_creation:
                if isinstance(date_of_creation, str):
                    try:
                        from datetime import datetime
                        incorporation_date = datetime.strptime(date_of_creation, '%Y-%m-%d').date()
                    except (ValueError, TypeError):
                        incorporation_date = None
                elif hasattr(date_of_creation, 'date'):
                    incorporation_date = date_of_creation.date() if hasattr(date_of_creation, 'date') else date_of_creation
            
            # Create or update company data
            company, _ = ConsultantCompanyData.objects.update_or_create(
                consultant=profile,
                defaults={
                    'company_number': company_number,
                    'company_name': company_profile.get('company_name', ''),
                    'company_name_original': company_profile.get('company_name', ''),
                    'company_status': company_profile.get('company_status', ''),
                    'incorporation_date': incorporation_date,
                    'company_type': company_profile.get('type', ''),
                    'sic_codes': company_profile.get('sic_codes', []),
                    'registered_address': company_data.get('registered_address', {}),
                    'companies_house_data': company_data,
                    'accounts_metadata': accounts,
                    'confirmation_statements_metadata': statements,
                    'incorporation_certificate_metadata': incorporation_cert or {},
                    'charges_metadata': charges,
                    'is_verified_via_companies_house': True,
                    'verified_via_companies_house_at': timezone.now(),
                    'last_synced_at': timezone.now(),
                    'is_confirmed': False,
                }
            )
            
            # Safely serialize incorporation_date
            incorporation_date_str = None
            if company.incorporation_date:
                if hasattr(company.incorporation_date, 'isoformat'):
                    incorporation_date_str = company.incorporation_date.isoformat()
                elif isinstance(company.incorporation_date, str):
                    incorporation_date_str = company.incorporation_date
                else:
                    incorporation_date_str = str(company.incorporation_date)
            
            return Response({
                'success': True,
                'company': {
                    'id': company.id,
                    'company_number': company.company_number,
                    'company_name': company.company_name,
                    'company_status': company.company_status,
                    'incorporation_date': incorporation_date_str,
                    'is_verified_via_companies_house': company.is_verified_via_companies_house,
                    'verified_via_companies_house_at': company.verified_via_companies_house_at.isoformat() if company.verified_via_companies_house_at else None,
                },
                'officers_count': len([o for o in officers if 'director' in o.get('officer_role', '').lower() and not o.get('resigned_on')]),
                'shareholders_count': len([p for p in psc if p.get('kind', '').lower() in ['individual-person-with-significant-control', 'corporate-entity-person-with-significant-control']]),
                'accounts_available': len(accounts),
                'statements_available': len(statements),
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to import company: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["get"])
    def get_full_company_details(self, request):
        """Get comprehensive company details including officers, shareholders, and documents."""
        try:
            profile = self._get_consultant_profile(request.user)
            company = getattr(profile, 'company_data', None)
            
            if not company:
                return Response({
                    'error': 'No company data found. Please import company first.',
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Safely serialize incorporation_date
            incorporation_date_str = None
            if company.incorporation_date:
                if hasattr(company.incorporation_date, 'isoformat'):
                    incorporation_date_str = company.incorporation_date.isoformat()
                elif isinstance(company.incorporation_date, str):
                    incorporation_date_str = company.incorporation_date
                else:
                    incorporation_date_str = str(company.incorporation_date)
            
            return Response({
                'company': {
                    'id': company.id,
                    'company_number': company.company_number,
                    'company_name': company.company_name,
                    'company_name_original': company.company_name_original,
                    'company_status': company.company_status,
                    'company_type': company.company_type,
                    'incorporation_date': incorporation_date_str,
                    'sic_codes': company.sic_codes,
                    'registered_address': company.registered_address,
                    'trading_address': company.trading_address,
                    'primary_contact_email': company.primary_contact_email,
                    'primary_contact_phone': company.primary_contact_phone,
                    'is_confirmed': company.is_confirmed,
                    'is_verified_via_companies_house': company.is_verified_via_companies_house,
                    'verified_via_companies_house_at': company.verified_via_companies_house_at.isoformat() if company.verified_via_companies_house_at else None,
                    'last_synced_at': company.last_synced_at.isoformat() if company.last_synced_at else None,
                },
                'officers': [],  # Consultants don't have officers model
                'shareholders': [],  # Consultants don't have shareholders model
                'accounts_metadata': company.accounts_metadata or [],
                'confirmation_statements_metadata': company.confirmation_statements_metadata or [],
                'incorporation_certificate_metadata': company.incorporation_certificate_metadata or {},
                'charges_metadata': company.charges_metadata or [],
                'selected_documents': company.selected_documents or [],
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to get company details: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def download_company_document(self, request):
        """Download a company document from Companies House."""
        try:
            company_number = request.data.get('company_number')
            transaction_id = request.data.get('transaction_id')
            document_type = request.data.get('document_type')
            
            if not company_number or not transaction_id:
                return Response(
                    {'error': 'company_number and transaction_id are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not self.companies_house_service:
                return Response(
                    {'error': 'Companies House service not available'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            
            # Download document
            document_content = self.companies_house_service.get_filing_document(
                company_number, 
                transaction_id
            )
            
            # Return document as base64 encoded for frontend
            import base64
            document_base64 = base64.b64encode(document_content).decode('utf-8')
            
            return Response({
                'success': True,
                'document': document_base64,
                'transaction_id': transaction_id,
                'document_type': document_type,
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to download document: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def save_selected_documents(self, request):
        """Save selected documents to company profile."""
        try:
            profile = self._get_consultant_profile(request.user)
            company = getattr(profile, 'company_data', None)
            
            if not company:
                return Response({
                    'error': 'No company data found. Please import company first.',
                }, status=status.HTTP_404_NOT_FOUND)
            
            selected_documents = request.data.get('selected_documents', [])
            if not isinstance(selected_documents, list):
                return Response(
                    {'error': 'selected_documents must be a list of transaction_ids'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate that all transaction_ids exist in available documents
            all_docs = []
            all_docs.extend([doc.get('transaction_id') for doc in (company.accounts_metadata or [])])
            all_docs.extend([doc.get('transaction_id') for doc in (company.confirmation_statements_metadata or [])])
            if company.incorporation_certificate_metadata:
                all_docs.append(company.incorporation_certificate_metadata.get('transaction_id'))
            all_docs.extend([doc.get('transaction_id') for doc in (company.charges_metadata or [])])
            
            # Filter to only valid transaction_ids
            valid_selected = [tid for tid in selected_documents if tid in all_docs]
            
            # Save selected documents
            company.selected_documents = valid_selected
            company.save()
            
            return Response({
                'success': True,
                'selected_documents': valid_selected,
                'message': f'Saved {len(valid_selected)} selected document(s)',
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to save selected documents: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to import company: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def confirm_company(self, request):
        """Consultant confirms company data."""
        try:
            profile = self._get_consultant_profile(request.user)
            company = getattr(profile, 'company_data', None)
            
            if not company:
                return Response(
                    {'error': 'No company data found. Please import company first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            trading_address = request.data.get('trading_address', {})
            primary_contact_email = request.data.get('primary_contact_email', '')
            primary_contact_phone = request.data.get('primary_contact_phone', '')
            
            company.trading_address = trading_address
            company.primary_contact_email = primary_contact_email
            company.primary_contact_phone = primary_contact_phone
            company.is_confirmed = True
            company.confirmed_at = timezone.now()
            company.save()
            
            return Response({
                'success': True,
                'company': {
                    'id': company.id,
                    'is_confirmed': company.is_confirmed,
                }
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to confirm company: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def submit_for_review(self, request):
        """Submit consultant profile for admin review."""
        try:
            profile = self._get_consultant_profile(request.user)
            
            if not profile.is_wizard_complete():
                return Response(
                    {'error': 'Please complete all wizard steps before submitting'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            profile.wizard_status = 'ready_for_review'
            profile.save()
            
            return Response({
                'success': True,
                'wizard_status': profile.wizard_status,
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to submit for review: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
