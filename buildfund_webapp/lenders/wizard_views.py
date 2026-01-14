"""Views for Lender Profile Wizard."""
from __future__ import annotations

import traceback
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction

from .models import LenderProfile
from .models_wizard import LenderCompanyData, LenderCompanyPerson
from borrowers.services import CompaniesHouseService


class LenderProfileWizardViewSet(viewsets.ViewSet):
    """ViewSet for Lender Profile Wizard."""
    
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
                import traceback
                print(f"Warning: CompaniesHouseService not available: {e}")
                print(traceback.format_exc())
                self._companies_house_service = None
            except Exception as e:
                import traceback
                print(f"Error initializing CompaniesHouseService: {e}")
                print(traceback.format_exc())
                self._companies_house_service = None
        return self._companies_house_service
    
    def _get_lender_profile(self, user):
        """Get or create lender profile for user."""
        profile, _ = LenderProfile.objects.get_or_create(user=user)
        return profile
    
    @action(detail=False, methods=["get"])
    def status(self, request):
        """Get current wizard status and progress."""
        try:
            profile = self._get_lender_profile(request.user)
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
            profile = self._get_lender_profile(request.user)
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
            query = request.data.get('query', '').strip()
            if not query:
                return Response(
                    {'error': 'query is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not self.companies_house_service:
                # Return empty results with a message instead of error
                return Response({
                    'results': [],
                    'count': 0,
                    'message': 'Companies House service not available. Please enter company details manually.',
                    'fallback_required': True,
                })
            
            try:
                results = self.companies_house_service.search_company(query)
                if not results:
                    return Response({
                        'results': [],
                        'count': 0,
                        'message': f'No companies found for "{query}". Please try a different search term or enter company details manually.',
                        'fallback_required': True,
                    })
                return Response({
                    'results': results,
                    'count': len(results),
                    'fallback_required': False,
                })
            except Exception as api_error:
                # API call failed - return empty results with fallback message
                error_msg = str(api_error)
                # Check if it's an authentication error
                if '401' in error_msg or 'Unauthorized' in error_msg or 'authentication' in error_msg.lower():
                    error_msg = 'Companies House API authentication failed. Please check your API key configuration.'
                return Response({
                    'results': [],
                    'count': 0,
                    'message': f'Could not search Companies House: {error_msg}. Please enter company details manually.',
                    'fallback_required': True,
                    'error': error_msg,
                })
        except Exception as e:
            return Response(
                {'error': f'Failed to search company: {str(e)}', 'fallback_required': True},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def import_company(self, request):
        """Import company data from Companies House."""
        try:
            company_number = request.data.get('company_number', '').strip()
            if not company_number:
                return Response(
                    {'error': 'company_number is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            profile = self._get_lender_profile(request.user)
            
            if not self.companies_house_service:
                # Fallback: create company data with manual entry
                company, _ = LenderCompanyData.objects.update_or_create(
                    lender=profile,
                    defaults={
                        'company_number': company_number,
                        'company_name': request.data.get('company_name', ''),
                        'company_status': 'unknown',
                        'is_confirmed': False,
                    }
                )
                return Response({
                    'success': True,
                    'company': {
                        'id': company.id,
                        'company_number': company.company_number,
                        'company_name': company.company_name,
                        'company_status': company.company_status,
                        'incorporation_date': None,
                    },
                    'persons_count': 0,
                    'fallback_used': True,
                    'message': 'Companies House service not available. Please enter company details manually.',
                })
            
            try:
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
                incorporation_cert = company_data.get('incorporation_certificate', None)
                charges = company_data.get('charges', [])
                
                # Parse date_of_creation from API response (format: YYYY-MM-DD)
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
            except Exception as api_error:
                # API call failed - create company data with manual entry
                company, _ = LenderCompanyData.objects.update_or_create(
                    lender=profile,
                    defaults={
                        'company_number': company_number,
                        'company_name': request.data.get('company_name', ''),
                        'company_status': 'unknown',
                        'is_confirmed': False,
                    }
                )
                return Response({
                    'success': True,
                    'company': {
                        'id': company.id,
                        'company_number': company.company_number,
                        'company_name': company.company_name,
                        'company_status': company.company_status,
                        'incorporation_date': None,
                    },
                    'persons_count': 0,
                    'fallback_used': True,
                    'message': f'Could not import from Companies House: {str(api_error)}. Please enter company details manually.',
                    'error': str(api_error),
                })
            
            # Create or update company data with all imported information
            company, _ = LenderCompanyData.objects.update_or_create(
                lender=profile,
                defaults={
                    'company_number': company_number,
                    'company_name': company_profile.get('company_name', ''),
                    'company_name_original': company_profile.get('company_name', ''),
                    'company_status': company_profile.get('company_status', ''),
                    'incorporation_date': incorporation_date,
                    'company_type': company_profile.get('type', ''),
                    'sic_codes': company_profile.get('sic_codes', []),
                    'registered_address': company_data.get('registered_address', {}),
                    'companies_house_data': company_data,  # Store full import data
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
            
            # Import officers as CompanyPerson - only active directors
            for officer in officers:
                officer_role = officer.get('officer_role', '').lower()
                # Only import active directors (not resigned)
                if 'director' in officer_role:
                    # Check if officer is resigned - skip if they have a resigned_on date
                    if officer.get('resigned_on'):
                        continue  # Skip resigned directors
                    
                    # Parse date_of_birth from API response
                    dob_obj = None
                    dob_data = officer.get('date_of_birth', {})
                    if dob_data and dob_data.get('year'):
                        try:
                            from datetime import date
                            dob_obj = date(
                                dob_data.get('year'),
                                dob_data.get('month', 1),
                                dob_data.get('day', 1)
                            )
                        except (ValueError, TypeError):
                            dob_obj = None
                    
                    # Use name as unique identifier along with company (since person_id might not be unique)
                    officer_name = officer.get('name', '').strip()
                    if not officer_name:
                        continue  # Skip if no name
                    
                    person_id = ''
                    if officer.get('links', {}).get('officer', {}).get('appointments'):
                        person_id = officer.get('links', {}).get('officer', {}).get('appointments', '').split('/')[-1]
                    
                    # Use name as primary identifier to avoid missing directors
                    LenderCompanyPerson.objects.update_or_create(
                        company=company,
                        name=officer_name,  # Use name as unique identifier
                        role='director',
                        defaults={
                            'person_id': person_id,
                            'date_of_birth': dob_obj,
                            'nationality': officer.get('nationality', ''),
                            'address': officer.get('address', {}),
                            'companies_house_data': officer,
                        }
                    )
            
            # Import PSC (Persons with Significant Control) as shareholders
            # Track processed names to avoid duplicates within the same import
            processed_psc = set()
            for psc_entry in psc:
                psc_kind = psc_entry.get('kind', '').lower()
                if 'individual' in psc_kind or 'corporate-entity' in psc_kind:
                    # Extract ownership percentage
                    ownership = None
                    natures_of_control = psc_entry.get('natures_of_control', [])
                    for nature in natures_of_control:
                        if 'ownership-of-shares' in nature.lower():
                            # Try to extract percentage from description
                            desc = psc_entry.get('description', '')
                            # Look for percentage patterns
                            import re
                            match = re.search(r'(\d+(?:\.\d+)?)\s*%', desc, re.IGNORECASE)
                            if match:
                                try:
                                    ownership = float(match.group(1))
                                except ValueError:
                                    pass
                            # Also check natures_of_control for ranges
                            if not ownership:
                                if '25-50' in nature or '50-75' in nature or '75-100' in nature:
                                    ownership = 50  # Default if range given
                    
                    # Determine role
                    role = 'psc'
                    if ownership and ownership >= 25:
                        role = 'shareholder'  # Significant shareholder
                    
                    psc_name = (psc_entry.get('name', '') or psc_entry.get('corporate_name', '')).strip()
                    if not psc_name:
                        continue  # Skip if no name
                    
                    # Skip if we've already processed this name+role combination in this import
                    psc_key = (psc_name.lower(), role)
                    if psc_key in processed_psc:
                        continue
                    processed_psc.add(psc_key)
                    
                    person_id = ''
                    if psc_entry.get('links', {}).get('self'):
                        person_id = psc_entry.get('links', {}).get('self', '').split('/')[-1]
                    
                    # Use name as unique identifier (matching directors logic)
                    try:
                        LenderCompanyPerson.objects.update_or_create(
                            company=company,
                            name=psc_name,  # Use name as unique identifier
                            role=role,
                            defaults={
                                'person_id': person_id,
                                'date_of_birth': None,  # PSC may not have DOB
                                'nationality': psc_entry.get('nationality', ''),
                                'address': psc_entry.get('address', {}),
                                'ownership_percentage': ownership,
                                'companies_house_data': psc_entry,
                            }
                        )
                    except Exception as e:
                        # If update_or_create fails due to race condition, try to get existing
                        try:
                            existing = LenderCompanyPerson.objects.get(
                                company=company,
                                name=psc_name,
                                role=role
                            )
                            # Update existing entry
                            existing.person_id = person_id
                            existing.nationality = psc_entry.get('nationality', '')
                            existing.address = psc_entry.get('address', {})
                            existing.ownership_percentage = ownership
                            existing.companies_house_data = psc_entry
                            existing.save()
                        except LenderCompanyPerson.DoesNotExist:
                            # Re-raise original error if it's not a duplicate
                            raise e
            
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
                },
                'persons_count': company.persons.count(),
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to import company: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def confirm_company(self, request):
        """Lender confirms company data."""
        try:
            profile = self._get_lender_profile(request.user)
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
    
    @action(detail=False, methods=["get"])
    def get_full_company_details(self, request):
        """Get comprehensive company details including officers, shareholders, and documents."""
        try:
            profile = self._get_lender_profile(request.user)
            company = getattr(profile, 'company_data', None)
            
            if not company:
                return Response({
                    'error': 'No company data found. Please import company first.',
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Get all persons - filter out resigned directors
            persons = company.persons.all()
            officers = persons.filter(role='director')
            # Filter out resigned directors by checking companies_house_data
            active_officers = []
            for officer in officers:
                ch_data = officer.companies_house_data or {}
                if not ch_data.get('resigned_on'):  # Only include active (not resigned)
                    active_officers.append(officer)
            officers = active_officers
            
            shareholders = persons.filter(role='shareholder')
            
            # Serialize officers
            officers_data = []
            for p in officers:
                dob_str = None
                if p.date_of_birth:
                    if hasattr(p.date_of_birth, 'isoformat'):
                        dob_str = p.date_of_birth.isoformat()
                    elif isinstance(p.date_of_birth, str):
                        dob_str = p.date_of_birth
                    else:
                        dob_str = str(p.date_of_birth)
                
                officers_data.append({
                    'id': p.id,
                    'name': p.name,
                    'role': p.role,
                    'date_of_birth': dob_str,
                    'nationality': p.nationality,
                    'address': p.address,
                    'is_confirmed': p.is_confirmed,
                    'companies_house_data': p.companies_house_data,
                })
            
            # Serialize shareholders
            shareholders_data = []
            for p in shareholders:
                shareholders_data.append({
                    'id': p.id,
                    'name': p.name,
                    'role': p.role,
                    'ownership_percentage': float(p.ownership_percentage) if p.ownership_percentage else None,
                    'nationality': p.nationality,
                    'address': p.address,
                    'is_confirmed': p.is_confirmed,
                    'companies_house_data': p.companies_house_data,
                })
            
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
                'officers': officers_data,
                'shareholders': shareholders_data,
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
        """Download a company document (account or confirmation statement) from Companies House."""
        try:
            company_number = request.data.get('company_number')
            transaction_id = request.data.get('transaction_id')
            document_type = request.data.get('document_type')  # 'account' or 'confirmation-statement'
            
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
    
    @action(detail=False, methods=["get"])
    def get_company_persons(self, request):
        """Get all company persons (directors, key personnel)."""
        try:
            profile = self._get_lender_profile(request.user)
            company = getattr(profile, 'company_data', None)
            
            if not company:
                return Response({
                    'persons': [],
                    'company': None,
                })
            
            persons = company.persons.all()
            persons_data = []
            for p in persons:
                # Safely serialize date_of_birth
                dob_str = None
                if p.date_of_birth:
                    if hasattr(p.date_of_birth, 'isoformat'):
                        dob_str = p.date_of_birth.isoformat()
                    elif isinstance(p.date_of_birth, str):
                        dob_str = p.date_of_birth
                    else:
                        dob_str = str(p.date_of_birth)
                
                persons_data.append({
                    'id': p.id,
                    'name': p.name,
                    'role': p.role,
                    'job_title': p.job_title,
                    'email': p.email,
                    'phone': p.phone,
                    'date_of_birth': dob_str,
                    'nationality': p.nationality,
                    'ownership_percentage': float(p.ownership_percentage) if p.ownership_percentage else None,
                    'is_confirmed': p.is_confirmed,
                })
            
            return Response({
                'persons': persons_data,
                'company': {
                    'id': company.id,
                    'company_name': company.company_name,
                    'company_number': company.company_number,
                    'is_confirmed': company.is_confirmed,
                }
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to get company persons: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def update_persons(self, request):
        """Update directors/personnel details."""
        try:
            profile = self._get_lender_profile(request.user)
            company = getattr(profile, 'company_data', None)
            
            if not company:
                return Response(
                    {'error': 'No company data found. Please import company first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            persons_data = request.data.get('persons', [])
            
            for person_data in persons_data:
                person_id = person_data.get('id')
                if person_id:
                    try:
                        person = LenderCompanyPerson.objects.get(id=person_id, company=company)
                        person.job_title = person_data.get('job_title', person.job_title)
                        person.email = person_data.get('email', person.email)
                        person.phone = person_data.get('phone', person.phone)
                        person.is_confirmed = person_data.get('is_confirmed', person.is_confirmed)
                        person.save()
                    except LenderCompanyPerson.DoesNotExist:
                        continue
            
            return Response({'success': True})
        except Exception as e:
            return Response(
                {'error': f'Failed to update persons: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def submit_for_review(self, request):
        """Submit lender profile for admin review."""
        try:
            profile = self._get_lender_profile(request.user)
            
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
