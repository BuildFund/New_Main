"""Views for Borrower Profile Wizard."""
from __future__ import annotations

import traceback
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.utils import timezone
from django.db import transaction

from core.throttles import PaidAPIThrottle
from .models import (
    BorrowerProfile, BorrowerConsent, CompanyData, CompanyPerson,
    ApplicantPersonalDetails, ApplicantFinancialSnapshot,
    OpenBankingConnection, BorrowerProfileReview, StepUpAuthentication
)
from .services import CompaniesHouseService, OpenBankingService
from .wizard_service import BorrowerProfileWizardService
from documents.models import Document, DocumentType


class BorrowerProfileWizardViewSet(viewsets.ViewSet):
    """ViewSet for Borrower Profile Wizard - 8-step onboarding."""
    
    permission_classes = [permissions.IsAuthenticated]
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.wizard_service = BorrowerProfileWizardService()
        self._companies_house_service = None
        self._open_banking_service = None
    
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
    
    @property
    def open_banking_service(self):
        """Lazy initialization of Open Banking service."""
        if self._open_banking_service is None:
            try:
                self._open_banking_service = OpenBankingService()
            except Exception as e:
                print(f"Warning: OpenBankingService not available: {e}")
                self._open_banking_service = None
        return self._open_banking_service
    
    def _get_borrower_profile(self, user):
        """Get or create borrower profile for user."""
        profile, _ = BorrowerProfile.objects.get_or_create(user=user)
        return profile
    
    @action(detail=False, methods=["get"])
    def status(self, request):
        """Get current wizard status and progress."""
        try:
            profile = self._get_borrower_profile(request.user)
            progress = profile.get_wizard_progress()
            
            return Response({
                'wizard_status': profile.wizard_status,
                'current_step': profile.current_wizard_step,
                'completed_steps': profile.completed_steps,
                'progress_percentage': progress,
                'is_complete': profile.is_wizard_complete(),
                'steps': self.wizard_service.WIZARD_STEPS,
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to get wizard status: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["get"])
    def step_info(self, request):
        """Get information about a specific wizard step."""
        step = request.query_params.get('step')
        if not step:
            return Response(
                {'error': 'step parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        step_info = self.wizard_service.get_step_info(step)
        questions = self.wizard_service.get_step_questions(step, {})
        
        return Response({
            'step': step,
            'info': step_info,
            'questions': questions,
        })
    
    @action(detail=False, methods=["post"])
    def save_step(self, request):
        """Save data for a wizard step."""
        try:
            step = request.data.get('step')
            data = request.data.get('data', {})
            
            if not step:
                return Response(
                    {'error': 'step is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate step
            validation = self.wizard_service.validate_step(step, data)
            if not validation['valid']:
                return Response(
                    {'error': 'Validation failed', 'errors': validation['errors']},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            profile = self._get_borrower_profile(request.user)
            
            # Save step data
            if not profile.wizard_data:
                profile.wizard_data = {}
            profile.wizard_data[step] = data
            
            # Mark step as completed if not already
            if step not in profile.completed_steps:
                profile.completed_steps.append(step)
            
            profile.current_wizard_step = step
            profile.wizard_status = 'in_progress'
            profile.save()
            
            return Response({
                'success': True,
                'message': f'Step {step} saved successfully',
                'progress': profile.get_wizard_progress(),
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to save step: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"], throttle_classes=[PaidAPIThrottle])
    def search_company(self, request):
        """Search Companies House for company (uses Companies House API - throttled)."""
        try:
            query = request.data.get('query')
            if not query:
                return Response(
                    {'error': 'query is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not self.companies_house_service:
                return Response(
                    {'error': 'Companies House service not available'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
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
    
    @action(detail=False, methods=["post"], throttle_classes=[PaidAPIThrottle])
    def import_company(self, request):
        """Import company data from Companies House (uses Companies House API - throttled)."""
        try:
            company_number = request.data.get('company_number')
            if not company_number:
                return Response(
                    {'error': 'company_number is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not self.companies_house_service:
                return Response(
                    {'error': 'Companies House service not available'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            
            # Import company data with documents
            company_data = self.companies_house_service.import_company_data(company_number, include_documents=True)
            
            profile = self._get_borrower_profile(request.user)
            
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
            
            # Create or update CompanyData
            company, created = CompanyData.objects.update_or_create(
                borrower=profile,
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
            
            # Import officers as CompanyPerson - only active directors
            for officer in officers:
                officer_role = officer.get('officer_role', '').lower()
                if 'director' in officer_role:
                    # Skip resigned directors
                    if officer.get('resigned_on'):
                        continue
                    
                    # Parse date_of_birth
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
                    
                    officer_name = officer.get('name', '').strip()
                    if not officer_name:
                        continue
                    
                    person_id = ''
                    if officer.get('links', {}).get('officer', {}).get('appointments'):
                        person_id = officer.get('links', {}).get('officer', {}).get('appointments', '').split('/')[-1]
                    
                    CompanyPerson.objects.update_or_create(
                        company=company,
                        name=officer_name,  # Use name as unique identifier
                        role='director',
                        defaults={
                            'person_id': person_id,
                            'date_of_birth': dob_obj,
                            'nationality': officer.get('nationality', ''),
                            'address': officer.get('address', {}),
                            'is_applicant_required': True,  # All directors are required
                            'companies_house_data': officer,
                        }
                    )
            
            # Import PSC
            for psc in company_data.get('psc', []):
                if psc.get('kind') == 'individual-person-with-significant-control':
                    ownership = psc.get('natures_of_control', [])
                    ownership_percentage = 0
                    # Extract ownership percentage if available
                    for nature in ownership:
                        if '25-50' in nature or '50-75' in nature or '75-100' in nature:
                            ownership_percentage = 50  # Default if range given
                    
                    CompanyPerson.objects.update_or_create(
                        company=company,
                        person_id=psc.get('links', {}).get('self', '').split('/')[-1] if psc.get('links') else '',
                        role='psc',
                        defaults={
                            'name': f"{psc.get('name', '')}",
                            'date_of_birth': psc.get('date_of_birth', {}).get('year') and f"{psc.get('date_of_birth', {}).get('year')}-{psc.get('date_of_birth', {}).get('month', 1):02d}-{psc.get('date_of_birth', {}).get('day', 1):02d}" or None,
                            'nationality': psc.get('nationality', ''),
                            'address': psc.get('address', {}),
                            'ownership_percentage': ownership_percentage if ownership_percentage >= 25 else None,
                            'is_applicant_required': ownership_percentage >= 25,
                            'companies_house_data': psc,
                        }
                    )
            
            # Get active officers count (excluding resigned)
            active_officers_count = len([o for o in officers if 'director' in o.get('officer_role', '').lower() and not o.get('resigned_on')])
            
            return Response({
                'success': True,
                'company': {
                    'id': company.id,
                    'company_number': company.company_number,
                    'company_name': company.company_name,
                    'company_status': company.company_status,
                    'incorporation_date': company.incorporation_date.isoformat() if company.incorporation_date else None,
                    'is_verified_via_companies_house': company.is_verified_via_companies_house,
                    'verified_via_companies_house_at': company.verified_via_companies_house_at.isoformat() if company.verified_via_companies_house_at else None,
                },
                'officers_count': active_officers_count,
                'shareholders_count': len([p for p in psc if p.get('kind', '').lower() in ['individual-person-with-significant-control', 'corporate-entity-person-with-significant-control']]),
                'persons_count': company.persons.count(),
                'accounts_available': len(accounts),
                'statements_available': len(statements),
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to import company: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def confirm_company(self, request):
        """Borrower confirms company data."""
        try:
            profile = self._get_borrower_profile(request.user)
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
                'message': 'Company data confirmed',
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to confirm company: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["get"])
    def get_company_persons(self, request):
        """Get all company persons (directors, shareholders, PSC)."""
        try:
            profile = self._get_borrower_profile(request.user)
            company = getattr(profile, 'company_data', None)
            
            if not company:
                return Response(
                    {'error': 'No company data found. Please import company first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            persons = CompanyPerson.objects.filter(company=company).order_by('role', 'name')
            persons_data = []
            for person in persons:
                persons_data.append({
                    'id': person.id,
                    'name': person.name,
                    'role': person.role,
                    'date_of_birth': person.date_of_birth.isoformat() if person.date_of_birth else None,
                    'nationality': person.nationality,
                    'ownership_percentage': person.ownership_percentage,
                    'is_applicant_required': person.is_applicant_required,
                    'is_confirmed': person.is_confirmed,
                    'is_deselected': person.is_deselected,
                    'deselection_reason': person.deselection_reason,
                })
            
            return Response({
                'persons': persons_data,
                'count': len(persons_data),
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to get company persons: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def update_persons(self, request):
        """Update directors/shareholders/PSC confirmation and roles."""
        try:
            profile = self._get_borrower_profile(request.user)
            company = getattr(profile, 'company_data', None)
            
            if not company:
                return Response(
                    {'error': 'No company data found'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            persons_data = request.data.get('persons', [])
            
            with transaction.atomic():
                for person_data in persons_data:
                    person_id = person_data.get('id')
                    if not person_id:
                        continue
                    
                    try:
                        person = CompanyPerson.objects.get(id=person_id, company=company)
                        person.is_confirmed = person_data.get('is_confirmed', False)
                        person.role = person_data.get('role', person.role)
                        person.ownership_percentage = person_data.get('ownership_percentage')
                        person.is_applicant_required = person_data.get('is_applicant_required', person.is_applicant_required)
                        person.is_deselected = person_data.get('is_deselected', False)
                        person.deselection_reason = person_data.get('deselection_reason', '')
                        person.save()
                    except CompanyPerson.DoesNotExist:
                        continue
            
            return Response({
                'success': True,
                'message': 'Persons updated successfully',
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to update persons: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def save_applicant_details(self, request):
        """Save applicant personal details."""
        try:
            profile = self._get_borrower_profile(request.user)
            company_person_id = request.data.get('company_person_id')
            
            if not company_person_id:
                return Response(
                    {'error': 'company_person_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                company_person = CompanyPerson.objects.get(id=company_person_id)
            except CompanyPerson.DoesNotExist:
                return Response(
                    {'error': 'Company person not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            data = request.data.get('data', {})
            
            applicant, created = ApplicantPersonalDetails.objects.update_or_create(
                company_person=company_person,
                borrower=profile,
                defaults={
                    'first_name': data.get('first_name'),
                    'last_name': data.get('last_name'),
                    'date_of_birth': data.get('date_of_birth'),
                    'nationality': data.get('nationality'),
                    'email': data.get('email'),
                    'phone': data.get('phone'),
                    'mobile': data.get('mobile', ''),
                    'current_address': data.get('current_address', {}),
                    'current_address_start_date': data.get('current_address_start_date'),
                    'previous_address': data.get('previous_address'),
                    'previous_address_start_date': data.get('previous_address_start_date'),
                    'previous_address_end_date': data.get('previous_address_end_date'),
                    'employment_status': data.get('employment_status'),
                    'occupation': data.get('occupation', ''),
                    'employment_start_date': data.get('employment_start_date'),
                    'net_monthly_income': data.get('net_monthly_income'),
                    'borrower_experience_tier': data.get('borrower_experience_tier', ''),
                    'adverse_credit_band': data.get('adverse_credit_band', ''),
                    'source_of_deposit': data.get('source_of_deposit', ''),
                    'intended_exit_strategy': data.get('intended_exit_strategy', ''),
                }
            )
            
            return Response({
                'success': True,
                'applicant_id': applicant.id,
                'message': 'Applicant details saved',
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to save applicant details: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def save_financial_snapshot(self, request):
        """Save financial snapshot (quick or detailed mode)."""
        try:
            profile = self._get_borrower_profile(request.user)
            applicant_id = request.data.get('applicant_id')
            mode = request.data.get('mode', 'quick')
            data = request.data.get('data', {})
            
            if not applicant_id:
                return Response(
                    {'error': 'applicant_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                applicant = ApplicantPersonalDetails.objects.get(id=applicant_id, borrower=profile)
            except ApplicantPersonalDetails.DoesNotExist:
                return Response(
                    {'error': 'Applicant not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            snapshot, created = ApplicantFinancialSnapshot.objects.update_or_create(
                applicant=applicant,
                defaults={
                    'mode': mode,
                    'total_income': data.get('total_income'),
                    'total_expenditure': data.get('total_expenditure'),
                    'total_assets': data.get('total_assets'),
                    'total_liabilities': data.get('total_liabilities'),
                    'income_breakdown': data.get('income_breakdown', []),
                    'expenditure_breakdown': data.get('expenditure_breakdown', []),
                    'assets_breakdown': data.get('assets_breakdown', []),
                    'liabilities_breakdown': data.get('liabilities_breakdown', []),
                    'data_source': data.get('data_source', 'manual'),
                }
            )
            
            return Response({
                'success': True,
                'snapshot_id': snapshot.id,
                'message': 'Financial snapshot saved',
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to save financial snapshot: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def submit_for_review(self, request):
        """Submit borrower profile for admin review."""
        try:
            profile = self._get_borrower_profile(request.user)
            
            # Check if all steps are completed
            if not profile.is_wizard_complete():
                return Response(
                    {'error': 'Please complete all wizard steps before submission'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create or update review
            review, created = BorrowerProfileReview.objects.get_or_create(
                borrower=profile,
                defaults={
                    'status': 'ready_for_review',
                    'submitted_at': timezone.now(),
                }
            )
            
            if not created:
                review.status = 'ready_for_review'
                review.submitted_at = timezone.now()
                review.save()
            
            profile.wizard_status = 'ready_for_review'
            profile.save()
            
            return Response({
                'success': True,
                'message': 'Borrower profile submitted for review',
                'review_id': review.id,
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to submit for review: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    def step_up_authenticate(self, request):
        """Create step-up authentication session."""
        try:
            purpose = request.data.get('purpose')
            if not purpose:
                return Response(
                    {'error': 'purpose is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Verify password (in production, use proper password verification)
            password = request.data.get('password')
            if not password or not request.user.check_password(password):
                return Response(
                    {'error': 'Invalid password'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            # Create step-up session (valid for 10 minutes)
            import secrets
            session_key = secrets.token_urlsafe(32)
            
            # Normalize purpose to match model choices
            purpose_map = {
                'access borrower information': 'profile_access',
                'view borrower information': 'profile_access',
                'borrower information': 'profile_access',
            }
            normalized_purpose = purpose_map.get(purpose.lower(), purpose)
            
            step_up = StepUpAuthentication.objects.create(
                user=request.user,
                session_key=session_key,
                expires_at=timezone.now() + timezone.timedelta(minutes=10),
                purpose=normalized_purpose,
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            
            return Response({
                'success': True,
                'session_key': session_key,
                'expires_at': step_up.expires_at.isoformat(),
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to create step-up session: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["get"])
    def verify_step_up(self, request):
        """Verify step-up authentication session."""
        session_key = request.query_params.get('session_key')
        purpose = request.query_params.get('purpose')
        
        if not session_key or not purpose:
            return Response(
                {'error': 'session_key and purpose are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            step_up = StepUpAuthentication.objects.get(
                user=request.user,
                session_key=session_key,
                purpose=purpose
            )
            
            if not step_up.is_valid():
                return Response(
                    {'error': 'Step-up session expired'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            return Response({
                'valid': True,
                'expires_at': step_up.expires_at.isoformat(),
            })
        except StepUpAuthentication.DoesNotExist:
            return Response(
                {'error': 'Invalid step-up session'},
                status=status.HTTP_401_UNAUTHORIZED
            )
    
    @action(detail=False, methods=["post"], throttle_classes=[PaidAPIThrottle])
    def initiate_open_banking(self, request):
        """Initiate Open Banking OAuth flow (uses Open Banking API - throttled)."""
        try:
            profile = self._get_borrower_profile(request.user)
            redirect_uri = request.data.get('redirect_uri')
            
            if not redirect_uri:
                return Response(
                    {'error': 'redirect_uri is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not self.open_banking_service:
                return Response(
                    {'error': 'Open Banking service not available'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            
            # Get authorization URL
            auth_data = self.open_banking_service.get_authorization_url(
                borrower_id=str(profile.id),
                redirect_uri=redirect_uri
            )
            
            # Store oauth_token and oauth_token_secret temporarily in session or database
            # For now, we'll return them to the frontend to store temporarily
            # In production, store in a temporary table with expiration
            
            return Response({
                'authorization_url': auth_data['authorization_url'],
                'oauth_token': auth_data['oauth_token'],
                'oauth_token_secret': auth_data['oauth_token_secret'],  # Store temporarily
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to initiate Open Banking: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"], throttle_classes=[PaidAPIThrottle])
    def complete_open_banking(self, request):
        """Complete Open Banking OAuth flow and save connection (uses Open Banking API - throttled)."""
        try:
            profile = self._get_borrower_profile(request.user)
            oauth_token = request.data.get('oauth_token')
            oauth_token_secret = request.data.get('oauth_token_secret')
            oauth_verifier = request.data.get('oauth_verifier')
            
            if not all([oauth_token, oauth_token_secret, oauth_verifier]):
                return Response(
                    {'error': 'oauth_token, oauth_token_secret, and oauth_verifier are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not self.open_banking_service:
                return Response(
                    {'error': 'Open Banking service not available'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            
            # Exchange token for access token
            access_token_data = self.open_banking_service.exchange_token_for_access(
                oauth_token=oauth_token,
                oauth_token_secret=oauth_token_secret,
                oauth_verifier=oauth_verifier
            )
            
            # Get accounts
            accounts = self.open_banking_service.get_accounts(
                oauth_token=access_token_data['oauth_token'],
                oauth_token_secret=access_token_data['oauth_token_secret']
            )
            
            # Filter business accounts first
            business_accounts = [acc for acc in accounts if acc.get('account_type', '').lower() in ['business', 'commercial', 'corporate']]
            personal_accounts = [acc for acc in accounts if acc not in business_accounts]
            
            # Store connection
            connection, created = OpenBankingConnection.objects.update_or_create(
                borrower=profile,
                defaults={
                    'provider': 'open_bank_project',
                    'provider_reference': access_token_data['oauth_token'],
                    'oauth_token': access_token_data['oauth_token'],
                    'oauth_token_secret': access_token_data['oauth_token_secret'],  # Encrypt in production
                    'account_ids': [acc.get('id') for acc in accounts],
                    'has_business_accounts': len(business_accounts) > 0,
                    'has_personal_accounts': len(personal_accounts) > 0,
                    'consent_timestamp': timezone.now(),
                    'last_sync_date': timezone.now(),
                    'is_active': True,
                }
            )
            
            # Get balances for all accounts
            account_data = []
            for account in accounts:
                try:
                    bank_id = account.get('bank_id', 'rbs')  # Default to rbs for sandbox
                    account_id = account.get('id')
                    balance_info = self.open_banking_service.get_account_balance(
                        oauth_token=access_token_data['oauth_token'],
                        oauth_token_secret=access_token_data['oauth_token_secret'],
                        account_id=account_id,
                        bank_id=bank_id
                    )
                    account_data.append({
                        'id': account_id,
                        'name': account.get('label', ''),
                        'type': account.get('account_type', ''),
                        'bank_id': bank_id,
                        'balance': balance_info.get('balance', {}).get('amount', '0'),
                        'currency': balance_info.get('balance', {}).get('currency', 'GBP'),
                    })
                except Exception as e:
                    # Continue if balance fetch fails for one account
                    account_data.append({
                        'id': account.get('id'),
                        'name': account.get('label', ''),
                        'type': account.get('account_type', ''),
                        'error': str(e),
                    })
            
            connection.account_balances = account_data
            connection.save()
            
            return Response({
                'success': True,
                'connection_id': connection.id,
                'accounts': account_data,
                'message': 'Open Banking connection established',
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to complete Open Banking: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=["post"])
    @action(detail=False, methods=["post"], throttle_classes=[PaidAPIThrottle])
    def sync_open_banking(self, request):
        """Sync Open Banking account data (uses Open Banking API - throttled)."""
        try:
            profile = self._get_borrower_profile(request.user)
            
            try:
                connection = OpenBankingConnection.objects.get(borrower=profile, is_active=True)
            except OpenBankingConnection.DoesNotExist:
                return Response(
                    {'error': 'No active Open Banking connection found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            if not self.open_banking_service:
                return Response(
                    {'error': 'Open Banking service not available'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            
            # Get updated accounts
            accounts = self.open_banking_service.get_accounts(
                oauth_token=connection.oauth_token,
                oauth_token_secret=connection.oauth_token_secret
            )
            
            # Update balances
            account_data = []
            for account in accounts:
                try:
                    bank_id = account.get('bank_id', 'rbs')
                    account_id = account.get('id')
                    balance_info = self.open_banking_service.get_account_balance(
                        oauth_token=connection.oauth_token,
                        oauth_token_secret=connection.oauth_token_secret,
                        account_id=account_id,
                        bank_id=bank_id
                    )
                    account_data.append({
                        'id': account_id,
                        'name': account.get('label', ''),
                        'type': account.get('account_type', ''),
                        'balance': balance_info.get('balance', {}).get('amount', '0'),
                        'currency': balance_info.get('balance', {}).get('currency', 'GBP'),
                    })
                except Exception as e:
                    account_data.append({
                        'id': account.get('id'),
                        'name': account.get('label', ''),
                        'error': str(e),
                    })
            
            connection.account_balances = account_data
            connection.last_sync_date = timezone.now()
            connection.save()
            
            return Response({
                'success': True,
                'accounts': account_data,
                'last_sync': connection.last_sync_date.isoformat(),
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to sync Open Banking: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
