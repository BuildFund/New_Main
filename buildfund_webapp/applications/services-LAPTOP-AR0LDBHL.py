"""Services for application-related operations."""
from __future__ import annotations

import json
from decimal import Decimal
from typing import Dict, Any, List, Optional
from django.utils import timezone
from django.conf import settings

from borrowers.models import BorrowerProfile
from projects.models import Project
from applications.models import Application, ApplicationDocument


class ReportInputBuilder:
    """Builds structured input data for underwriter report generation."""
    
    def __init__(self, application: Application):
        self.application = application
        self.borrower_profile = application.project.borrower
        self.project = application.project
        self.lender = application.lender
    
    def build(self) -> Dict[str, Any]:
        """Build complete input data structure for report generation."""
        return {
            'meta': self._build_meta(),
            'company': self._build_company_data(),
            'directors_and_shareholders': self._build_directors_shareholders(),
            'applicants_and_guarantors': self._build_applicants_guarantors(),
            'financial_overview': self._build_financial_overview(),
            'bank_data_summary': self._build_bank_data_summary(),
            'funding_requirement': self._build_funding_requirement(),
            'linked_project_data': self._build_linked_project_data(),
            'documents_index': self._build_documents_index(),
            'derived_metrics': self._build_derived_metrics(),
            'data_completeness': self._build_data_completeness(),
        }
    
    def _build_meta(self) -> Dict[str, Any]:
        """Build metadata section."""
        return {
            'application_id': self.application.id,
            'generated_at': timezone.now().isoformat(),
            'borrower_profile_status': self.borrower_profile.status,
            'borrower_profile_approved': self.borrower_profile.is_approved(),
        }
    
    def _build_company_data(self) -> Dict[str, Any]:
        """Build company information from Companies House data."""
        # Handle case where company_data might be stored as JSON string
        company_data = self.borrower_profile.company_data or {}
        if isinstance(company_data, str):
            try:
                company_data = json.loads(company_data)
            except (json.JSONDecodeError, TypeError):
                company_data = {}
        
        # Ensure company_data is a dict
        if not isinstance(company_data, dict):
            company_data = {}
        
        # Mask sensitive data
        registered_address = company_data.get('registered_office_address', {})
        if isinstance(registered_address, dict):
            address_parts = [
                registered_address.get('address_line_1', ''),
                registered_address.get('address_line_2', ''),
                registered_address.get('locality', ''),
            ]
            address = ', '.join(filter(None, address_parts))
        else:
            address = str(registered_address) if registered_address else 'Not provided'
        
        return {
            'company_name': company_data.get('company_name') or self.borrower_profile.company_name or 'Not provided',
            'company_number': company_data.get('company_number') or self.borrower_profile.registration_number or 'Not provided',
            'company_status': company_data.get('company_status', 'Not provided'),
            'incorporation_date': company_data.get('date_of_creation', 'Not provided'),
            'registered_address': address,
            'sic_codes': company_data.get('sic_codes', []),
            'trading_address': self.borrower_profile.trading_address or 'Not provided',
            'primary_contact_email': self._mask_email(self.borrower_profile.primary_contact_email) if self.borrower_profile.primary_contact_email else 'Not provided',
            'primary_contact_phone': self._mask_phone(self.borrower_profile.primary_contact_phone) if self.borrower_profile.primary_contact_phone else 'Not provided',
            'verified_at': self.borrower_profile.company_verified_at.isoformat() if self.borrower_profile.company_verified_at else None,
        }
    
    def _build_directors_shareholders(self) -> Dict[str, Any]:
        """Build directors and shareholders data."""
        # Handle case where data might be stored as JSON string
        directors = self.borrower_profile.directors_data or []
        if isinstance(directors, str):
            try:
                directors = json.loads(directors)
            except (json.JSONDecodeError, TypeError):
                directors = []
        
        shareholders = self.borrower_profile.shareholders_data or []
        if isinstance(shareholders, str):
            try:
                shareholders = json.loads(shareholders)
            except (json.JSONDecodeError, TypeError):
                shareholders = []
        
        # Ensure directors and shareholders are lists
        if not isinstance(directors, list):
            directors = []
        if not isinstance(shareholders, list):
            shareholders = []
        
        # Filter out resigned directors - ensure each item is a dict
        active_directors = []
        for d in directors:
            if not isinstance(d, dict):
                continue
            if not d.get('resigned_on') and not d.get('resigned'):
                active_directors.append(d)
        
        return {
            'directors': [
                {
                    'name': d.get('name', 'Not provided'),
                    'nationality': d.get('nationality', 'Not provided'),
                    'date_of_birth': self._mask_dob(d.get('date_of_birth')) if d.get('date_of_birth') else 'Not provided',
                    'appointed_on': d.get('appointed_on', 'Not provided'),
                    'role': 'Director',
                }
                for d in active_directors
            ],
            'shareholders_pscs': [
                {
                    'name': s.get('name', 'Not provided') if isinstance(s, dict) else 'Not provided',
                    'ownership_percentage': float(s.get('ownership_percentage', 0)) if (isinstance(s, dict) and s.get('ownership_percentage')) else (
                        float(s.get('natures_of_control', [{}])[0].get('percentage', 0)) if (isinstance(s, dict) and s.get('natures_of_control') and isinstance(s.get('natures_of_control'), list) and len(s.get('natures_of_control')) > 0 and isinstance(s.get('natures_of_control')[0], dict)) else 0
                    ),
                    'role': 'Shareholder/PSC',
                }
                for s in shareholders if isinstance(s, dict)
            ],
        }
    
    def _build_applicants_guarantors(self) -> List[Dict[str, Any]]:
        """Build applicants and guarantors data."""
        # Handle case where applicants_data might be stored as JSON string
        applicants = self.borrower_profile.applicants_data or []
        if isinstance(applicants, str):
            try:
                applicants = json.loads(applicants)
            except (json.JSONDecodeError, TypeError):
                applicants = []
        
        # Ensure applicants is a list
        if not isinstance(applicants, list):
            applicants = []
        
        result = []
        for applicant in applicants:
            # Skip if applicant is not a dict
            if not isinstance(applicant, dict):
                continue
            # Mask sensitive data
            dob = self._mask_dob(applicant.get('date_of_birth')) if applicant.get('date_of_birth') else 'Not provided'
            address = self._mask_address(applicant.get('current_address', '')) if applicant.get('current_address') else 'Not provided'
            
            result.append({
                'name': f"{applicant.get('first_name', '')} {applicant.get('last_name', '')}".strip() or 'Not provided',
                'role': applicant.get('role', 'Applicant'),
                'date_of_birth': dob,
                'nationality': applicant.get('nationality', 'Not provided'),
                'address': address,
                'employment_status': applicant.get('employment_status', 'Not provided'),
                'occupation': applicant.get('occupation', 'Not provided'),
                'employment_start_date': applicant.get('employment_start_date', 'Not provided'),
                'net_monthly_income': float(applicant.get('net_monthly_income', 0)) if applicant.get('net_monthly_income') else None,
                'experience_tier': applicant.get('experience_tier', 'Not provided'),
                'adverse_credit_band': applicant.get('adverse_credit_band', 'Not provided'),
                'source_of_deposit': applicant.get('source_of_deposit', 'Not provided'),
                'exit_strategy': applicant.get('exit_strategy', 'Not provided'),
            })
        
        return result if result else [{'note': 'No applicant data provided'}]
    
    def _build_financial_overview(self) -> Dict[str, Any]:
        """Build financial overview from borrower profile."""
        # Handle case where financial_data might be stored as JSON string
        financial_data = self.borrower_profile.financial_data or {}
        if isinstance(financial_data, str):
            try:
                financial_data = json.loads(financial_data)
            except (json.JSONDecodeError, TypeError):
                financial_data = {}
        
        # Ensure financial_data is a dict
        if not isinstance(financial_data, dict):
            financial_data = {}
        
        mode = self.borrower_profile.financial_mode or 'quick'
        
        # Include company charges in financial overview
        charges_summary = self.borrower_profile.charges_summary or {}
        if isinstance(charges_summary, str):
            try:
                charges_summary = json.loads(charges_summary)
            except (json.JSONDecodeError, TypeError):
                charges_summary = {}
        
        # Ensure charges_summary is a dict
        if not isinstance(charges_summary, dict):
            charges_summary = {}
        
        # Handle different possible structures of charges_summary
        if isinstance(charges_summary, dict):
            # If it's already a dict with the expected structure
            if 'active' in charges_summary or 'satisfied' in charges_summary:
                # It's the nested structure: {active: [...], satisfied: [...]}
                active_list = charges_summary.get('active', [])
                satisfied_list = charges_summary.get('satisfied', [])
                base_data = {
                    'charges_summary': {
                        'total_charges': len(active_list) + len(satisfied_list),
                        'active_charges': len(active_list),
                        'satisfied_charges': len(satisfied_list),
                        'active_charges_list': active_list[:10],  # Limit to 10 for report
                    }
                }
            else:
                # It's the flat structure: {total_charges: X, active_charges: Y, ...}
                base_data = {
                    'charges_summary': {
                        'total_charges': charges_summary.get('total_charges', 0),
                        'active_charges': charges_summary.get('active_charges', 0),
                        'satisfied_charges': charges_summary.get('satisfied_charges', 0),
                        'active_charges_list': charges_summary.get('active_charges_list', [])[:10],
                    }
                }
        else:
            base_data = {
                'charges_summary': {
                    'total_charges': 0,
                    'active_charges': 0,
                    'satisfied_charges': 0,
                    'active_charges_list': [],
                }
            }
        
        if mode == 'quick':
            return {
                'mode': 'quick',
                'income_total': float(financial_data.get('income_total', 0)) if financial_data.get('income_total') else None,
                'expenditure_total': float(financial_data.get('expenditure_total', 0)) if financial_data.get('expenditure_total') else None,
                'assets_total': float(financial_data.get('assets_total', 0)) if financial_data.get('assets_total') else None,
                'liabilities_total': float(financial_data.get('liabilities_total', 0)) if financial_data.get('liabilities_total') else None,
                **base_data,
            }
        else:
            return {
                'mode': 'detailed',
                'income_breakdown': financial_data.get('income_breakdown', []),
                'expenditure_breakdown': financial_data.get('expenditure_breakdown', []),
                'assets_breakdown': financial_data.get('assets_breakdown', []),
                'liabilities_breakdown': financial_data.get('liabilities_breakdown', []),
                **base_data,
            }
    
    def _build_bank_data_summary(self) -> Dict[str, Any]:
        """Build bank data summary."""
        method = self.borrower_profile.bank_data_method or 'Not provided'
        
        if method == 'open_banking':
            accounts = self.borrower_profile.open_banking_accounts or []
            # Handle case where accounts might be stored as JSON string
            if isinstance(accounts, str):
                try:
                    accounts = json.loads(accounts)
                except (json.JSONDecodeError, TypeError):
                    accounts = []
            
            # Ensure accounts is a list
            if not isinstance(accounts, list):
                accounts = []
            
            return {
                'method': 'open_banking',
                'provider': self.borrower_profile.open_banking_provider or 'Not provided',
                'connected': self.borrower_profile.open_banking_connected,
                'last_sync': self.borrower_profile.open_banking_last_sync.isoformat() if self.borrower_profile.open_banking_last_sync else None,
                'accounts': [
                    {
                        'account_name': self._mask_account(acc.get('account_name', 'Account') if isinstance(acc, dict) else 'Account'),
                        'account_number_masked': self._mask_account_number(acc.get('account_number', '') if isinstance(acc, dict) else ''),
                        'balance': float(acc.get('balance', 0)) if (isinstance(acc, dict) and acc.get('balance')) else None,
                        'account_type': acc.get('account_type', 'Not provided') if isinstance(acc, dict) else 'Not provided',
                    }
                    for acc in accounts if isinstance(acc, dict)
                ],
                'summary': {
                    'total_balance': sum(float(acc.get('balance', 0)) for acc in accounts if isinstance(acc, dict) and acc.get('balance')),
                    'account_count': len(accounts),
                },
            }
        elif method == 'pdf_upload':
            statements = self.borrower_profile.bank_statements or []
            return {
                'method': 'pdf_upload',
                'statements_count': len(statements),
                'statements_present': len(statements) > 0,
                'coverage': 'Last 3 months' if len(statements) >= 3 else f'{len(statements)} month(s)' if statements else 'Not provided',
            }
        else:
            return {
                'method': 'Not provided',
                'note': 'No bank data available',
            }
    
    def _build_funding_requirement(self) -> Dict[str, Any]:
        """Build funding requirement from application."""
        return {
            'loan_amount': float(self.application.proposed_loan_amount),
            'term_months': self.application.proposed_term_months,
            'interest_rate': float(self.application.proposed_interest_rate) if self.application.proposed_interest_rate else None,
            'ltv_ratio': float(self.application.proposed_ltv_ratio) if self.application.proposed_ltv_ratio else None,
            'product_type': self.application.product.funding_type if self.application.product else 'Not provided',
            'repayment_method': self.project.repayment_method if self.project else 'Not provided',
            'security': 'Property' if self.project else 'Not specified',
            'exit_strategy': self.project.repayment_method if self.project else 'Not provided',
        }
    
    def _build_linked_project_data(self) -> Dict[str, Any]:
        """Build linked project data (read-only)."""
        if not self.project:
            return {'note': 'No linked project data'}
        
        return {
            'project_reference': self.project.project_reference or 'Not provided',
            'funding_type': self.project.funding_type,
            'property_type': self.project.property_type,
            'address': f"{self.project.address}, {self.project.town}, {self.project.postcode}",
            'development_extent': self.project.development_extent,
            'tenure': self.project.tenure,
            'purchase_price': float(self.project.purchase_price) if self.project.purchase_price else None,
            'build_cost': float(self.project.build_cost) if self.project.build_cost else None,
            'current_market_value': float(self.project.current_market_value) if self.project.current_market_value else None,
            'gross_development_value': float(self.project.gross_development_value) if self.project.gross_development_value else None,
            'funds_provided_by_applicant': float(self.project.funds_provided_by_applicant) if self.project.funds_provided_by_applicant else None,
        }
    
    def _build_lender_and_product_data(self) -> Dict[str, Any]:
        """Build lender and product information."""
        if not self.lender:
            return {'note': 'No lender data available'}
        
        product = self.application.product if hasattr(self.application, 'product') and self.application.product else None
        
        return {
            'lender': {
                'name': getattr(self.lender, 'organisation_name', None) or 'Not provided',
                'company_number': getattr(self.lender, 'company_number', None) or 'Not provided',
                'contact_email': self._mask_email(self.lender.contact_email) if self.lender.contact_email else 'Not provided',
                'contact_phone': self._mask_phone(self.lender.contact_phone) if self.lender.contact_phone else 'Not provided',
                'website': getattr(self.lender, 'website', None) or 'Not provided',
            },
            'product': {
                'name': product.name if product else 'Not provided',
                'funding_type': product.funding_type if product else 'Not provided',
                'min_loan_amount': float(product.min_loan_amount) if product and product.min_loan_amount else None,
                'max_loan_amount': float(product.max_loan_amount) if product and product.max_loan_amount else None,
                'min_term_months': product.term_min_months if product else None,
                'max_term_months': product.term_max_months if product else None,
                'interest_rate_range': f"{float(product.interest_rate_min)}-{float(product.interest_rate_max)}%" if product else 'Not provided',
                'ltv_range': f"Up to {float(product.max_ltv_ratio)}%" if product and product.max_ltv_ratio is not None else 'Not provided',
                'description': product.description if product else 'Not provided',
            } if product else {'note': 'No product data available'},
        }
    
    def _build_documents_index(self) -> List[Dict[str, Any]]:
        """Build documents index (names and types only)."""
        app_docs = ApplicationDocument.objects.filter(application=self.application).select_related('document')
        
        company_docs = self.borrower_profile.company_documents or {}
        personal_docs = self.borrower_profile.personal_documents or {}
        
        result = []
        
        # Application documents
        for app_doc in app_docs:
            result.append({
                'name': app_doc.document.file_name if app_doc.document else 'Unknown',
                'type': app_doc.document.document_type if app_doc.document else 'Unknown',
                'category': 'application',
            })
        
        # Company documents
        for doc_type, docs in company_docs.items():
            if isinstance(docs, list):
                for doc in docs:
                    result.append({
                        'name': doc.get('file_name', 'Unknown'),
                        'type': doc_type,
                        'category': 'company',
                    })
        
        # Personal documents
        for doc_type, docs in personal_docs.items():
            if isinstance(docs, list):
                for doc in docs:
                    result.append({
                        'name': doc.get('file_name', 'Unknown'),
                        'type': doc_type,
                        'category': 'personal',
                    })
        
        return result if result else [{'note': 'No documents indexed'}]
    
    def _build_derived_metrics(self) -> Dict[str, Any]:
        """Calculate derived metrics."""
        metrics = {}
        
        # LTV calculation
        if self.project and self.project.current_market_value and self.application.proposed_loan_amount:
            ltv = (float(self.application.proposed_loan_amount) / float(self.project.current_market_value)) * 100
            metrics['ltv'] = round(ltv, 2)
        
        # LTC calculation
        if self.project and self.project.build_cost and self.application.proposed_loan_amount:
            ltc = (float(self.application.proposed_loan_amount) / float(self.project.build_cost)) * 100
            metrics['ltc'] = round(ltc, 2)
        
        # Net worth (if financial data available)
        financial_data = self.borrower_profile.financial_data or {}
        if financial_data.get('assets_total') and financial_data.get('liabilities_total'):
            net_worth = float(financial_data['assets_total']) - float(financial_data['liabilities_total'])
            metrics['net_worth'] = net_worth
        
        return metrics if metrics else {'note': 'Insufficient data for derived metrics'}
    
    def _build_data_completeness(self) -> Dict[str, Any]:
        """Build data completeness indicators."""
        completeness = {
            'company_data': bool(self.borrower_profile.company_data),
            'directors_data': bool(self.borrower_profile.directors_data),
            'applicants_data': bool(self.borrower_profile.applicants_data),
            'financial_data': bool(self.borrower_profile.financial_data),
            'bank_data': bool(self.borrower_profile.bank_data_method),
            'project_data': bool(self.project),
            'documents': bool(ApplicationDocument.objects.filter(application=self.application).exists()),
        }
        
        total = len(completeness)
        complete = sum(1 for v in completeness.values() if v)
        percentage = round((complete / total) * 100, 1) if total > 0 else 0
        
        return {
            **completeness,
            'overall_completeness_percentage': percentage,
            'missing_sections': [k for k, v in completeness.items() if not v],
        }
    
    # Helper methods for data masking
    def _mask_email(self, email: str) -> str:
        """Mask email address (show only first letter and domain)."""
        if not email or '@' not in email:
            return email
        parts = email.split('@')
        if len(parts[0]) > 1:
            return f"{parts[0][0]}***@{parts[1]}"
        return f"***@{parts[1]}"
    
    def _mask_phone(self, phone: str) -> str:
        """Mask phone number (show only last 4 digits)."""
        if not phone or len(phone) <= 4:
            return '***'
        return f"***{phone[-4:]}"
    
    def _mask_dob(self, dob: str) -> str:
        """Mask date of birth (show only year)."""
        if not dob:
            return 'Not provided'
        # Extract year if it's a date string
        if '-' in dob:
            return dob.split('-')[0] + '-**-**'
        return '****'
    
    def _mask_address(self, address: str) -> str:
        """Mask address (show only city/postcode)."""
        if not address:
            return 'Not provided'
        # Simple masking - in production, parse and show only city/postcode
        parts = address.split(',')
        if len(parts) >= 2:
            return f"***, {', '.join(parts[-2:])}"
        return '***'
    
    def _mask_account(self, account_name: str) -> str:
        """Mask account name."""
        if not account_name:
            return 'Account'
        if len(account_name) > 10:
            return f"{account_name[:3]}***{account_name[-3:]}"
        return '***'
    
    def _mask_account_number(self, account_number: str) -> str:
        """Mask account number (show only last 4 digits)."""
        if not account_number or len(account_number) <= 4:
            return '****'
        return f"****{account_number[-4:]}"
