"""Service for Borrower Profile Wizard - 8-step onboarding process."""
from __future__ import annotations

from typing import Dict, Any, List, Optional
from django.utils import timezone


class BorrowerProfileWizardService:
    """Service for managing the 8-step Borrower Profile Wizard."""
    
    WIZARD_STEPS = [
        'account_setup',
        'company_verification',
        'directors_shareholders',
        'applicant_details',
        'financial_snapshot',
        'bank_data',
        'documents',
        'submission',
    ]
    
    def get_step_info(self, step: str) -> Dict[str, Any]:
        """Get information about a wizard step."""
        step_info = {
            'account_setup': {
                'title': 'Account Setup and Consent',
                'description': 'Set up your account and provide required consents',
                'fields': ['email', 'password', 'mobile_number', 'mfa_enabled', 'privacy_consent', 'terms_consent', 'credit_search_consent'],
            },
            'company_verification': {
                'title': 'Company Verification',
                'description': 'Verify your UK company with Companies House',
                'fields': ['company_number', 'company_name', 'trading_address', 'primary_contact'],
            },
            'directors_shareholders': {
                'title': 'Directors and Shareholders',
                'description': 'Confirm directors and shareholders (>=25% ownership)',
                'fields': ['directors', 'shareholders', 'psc', 'ownership_percentages'],
            },
            'applicant_details': {
                'title': 'Applicant Personal Details',
                'description': 'Personal information for required applicants',
                'fields': ['name', 'dob', 'nationality', 'contact', 'address_history', 'employment', 'income', 'underwriting_flags'],
            },
            'financial_snapshot': {
                'title': 'Financial Snapshot',
                'description': 'Assets and liabilities (quick or detailed mode)',
                'fields': ['mode', 'income', 'expenditure', 'assets', 'liabilities'],
            },
            'bank_data': {
                'title': 'Bank Data',
                'description': 'Connect Open Banking or upload PDF statements',
                'fields': ['method', 'open_banking_connection', 'pdf_statements'],
            },
            'documents': {
                'title': 'Documents',
                'description': 'Upload required company and personal documents',
                'fields': ['company_accounts', 'management_accounts', 'photo_id'],
            },
            'submission': {
                'title': 'Submission for Review',
                'description': 'Submit your borrower profile for internal review',
                'fields': ['review_checklist'],
            },
        }
        return step_info.get(step, {})
    
    def get_step_questions(self, step: str, collected_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get questions for a specific wizard step."""
        questions = {
            'account_setup': [
                {
                    'field': 'email',
                    'question': 'What is your email address?',
                    'type': 'email',
                    'required': True,
                },
                {
                    'field': 'mobile_number',
                    'question': 'What is your mobile number?',
                    'type': 'phone',
                    'required': True,
                },
                {
                    'field': 'mfa_enabled',
                    'question': 'Would you like to enable two-factor authentication (2FA) for added security?',
                    'type': 'select',
                    'options': ['Yes', 'No'],
                    'required': True,
                },
                {
                    'field': 'privacy_consent',
                    'question': 'Do you consent to our Privacy Policy? (Required)',
                    'type': 'select',
                    'options': ['Yes, I consent', 'No'],
                    'required': True,
                },
                {
                    'field': 'terms_consent',
                    'question': 'Do you agree to our Terms of Service? (Required)',
                    'type': 'select',
                    'options': ['Yes, I agree', 'No'],
                    'required': True,
                },
                {
                    'field': 'credit_search_consent',
                    'question': 'Do you consent to credit searches being performed? (Required for loan applications)',
                    'type': 'select',
                    'options': ['Yes, I consent', 'No'],
                    'required': True,
                },
            ],
            'company_verification': [
                {
                    'field': 'company_search',
                    'question': 'Enter your UK company number or company name to search Companies House:',
                    'type': 'text',
                    'required': True,
                    'help_text': 'We will import company data from Companies House',
                },
            ],
            'directors_shareholders': [
                {
                    'field': 'review_persons',
                    'question': 'Please review the directors and shareholders imported from Companies House. Confirm each person and assign roles.',
                    'type': 'custom',
                    'required': True,
                },
            ],
            'applicant_details': [
                {
                    'field': 'first_name',
                    'question': 'First name:',
                    'type': 'text',
                    'required': True,
                },
                {
                    'field': 'last_name',
                    'question': 'Last name:',
                    'type': 'text',
                    'required': True,
                },
                {
                    'field': 'date_of_birth',
                    'question': 'Date of birth (DD/MM/YYYY):',
                    'type': 'date',
                    'required': True,
                },
                {
                    'field': 'nationality',
                    'question': 'Nationality:',
                    'type': 'text',
                    'required': True,
                },
                {
                    'field': 'current_address',
                    'question': 'Current address:',
                    'type': 'address',
                    'required': True,
                },
                {
                    'field': 'previous_address',
                    'question': 'Previous address (only if current address < 3 years):',
                    'type': 'address',
                    'required': False,
                },
                {
                    'field': 'employment_status',
                    'question': 'Employment status:',
                    'type': 'select',
                    'options': ['Employed', 'Self-employed', 'Retired', 'Other'],
                    'required': True,
                },
                {
                    'field': 'occupation',
                    'question': 'Occupation:',
                    'type': 'text',
                    'required': True,
                },
                {
                    'field': 'employment_start_date',
                    'question': 'Employment start date:',
                    'type': 'date',
                    'required': True,
                },
                {
                    'field': 'net_monthly_income',
                    'question': 'Net monthly income (GBP):',
                    'type': 'number',
                    'required': True,
                },
                {
                    'field': 'borrower_experience_tier',
                    'question': 'Borrower experience tier:',
                    'type': 'select',
                    'options': ['0 deals', '1-3 deals', '4-10 deals', '10+ deals'],
                    'required': True,
                },
                {
                    'field': 'adverse_credit_band',
                    'question': 'Adverse credit band:',
                    'type': 'select',
                    'options': ['None', 'Minor', 'Significant'],
                    'required': True,
                },
                {
                    'field': 'source_of_deposit',
                    'question': 'Source of deposit:',
                    'type': 'select',
                    'options': ['Savings', 'Sale of property', 'Inheritance', 'Gift', 'Other'],
                    'required': True,
                },
                {
                    'field': 'intended_exit_strategy',
                    'question': 'Intended exit strategy:',
                    'type': 'select',
                    'options': ['Sale', 'Refinance', 'Rental income', 'Other'],
                    'required': True,
                },
            ],
            'financial_snapshot': [
                {
                    'field': 'mode',
                    'question': 'Choose financial data entry mode:',
                    'type': 'select',
                    'options': ['Quick Mode (Totals Only)', 'Detailed Mode (Line Items)'],
                    'required': True,
                },
            ],
            'bank_data': [
                {
                    'field': 'method',
                    'question': 'How would you like to provide bank data?',
                    'type': 'select',
                    'options': ['Connect Open Banking (Recommended)', 'Upload PDF Statements'],
                    'required': True,
                },
            ],
            'documents': [
                {
                    'field': 'company_accounts',
                    'question': 'Upload last 2 years statutory accounts:',
                    'type': 'file',
                    'required': True,
                },
                {
                    'field': 'management_accounts',
                    'question': 'Upload latest management accounts (if available):',
                    'type': 'file',
                    'required': False,
                },
                {
                    'field': 'photo_id',
                    'question': 'Upload photo ID (for applicants only):',
                    'type': 'file',
                    'required': True,
                },
            ],
            'submission': [
                {
                    'field': 'review_checklist',
                    'question': 'Please review all information before submission. Click "Submit for Review" when ready.',
                    'type': 'custom',
                    'required': True,
                },
            ],
        }
        return questions.get(step, [])
    
    def validate_step(self, step: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate data for a wizard step."""
        errors = {}
        
        if step == 'account_setup':
            if not data.get('email'):
                errors['email'] = 'Email is required'
            if not data.get('mobile_number'):
                errors['mobile_number'] = 'Mobile number is required'
            if not data.get('privacy_consent') or data.get('privacy_consent') != 'Yes, I consent':
                errors['privacy_consent'] = 'Privacy policy consent is required'
            if not data.get('terms_consent') or data.get('terms_consent') != 'Yes, I agree':
                errors['terms_consent'] = 'Terms of service agreement is required'
            if not data.get('credit_search_consent') or data.get('credit_search_consent') != 'Yes, I consent':
                errors['credit_search_consent'] = 'Credit search consent is required'
        
        elif step == 'company_verification':
            if not data.get('company_number') and not data.get('company_name'):
                errors['company'] = 'Company number or name is required'
        
        elif step == 'applicant_details':
            required_fields = ['first_name', 'last_name', 'date_of_birth', 'nationality', 'employment_status', 'net_monthly_income']
            for field in required_fields:
                if not data.get(field):
                    errors[field] = f'{field.replace("_", " ").title()} is required'
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
        }
    
    def calculate_progress(self, completed_steps: List[str]) -> int:
        """Calculate wizard completion percentage."""
        total = len(self.WIZARD_STEPS)
        completed = len(completed_steps)
        return int((completed / total) * 100) if total > 0 else 0
