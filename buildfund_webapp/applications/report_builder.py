"""Service to build input data for Underwriter's Report generation."""
from __future__ import annotations

from typing import Dict, Any, List, Optional
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta


class ReportInputBuilder:
    """Builds structured input data for underwriter report generation."""
    
    def __init__(self, application):
        """Initialize with an Application instance."""
        self.application = application
        self.project = application.project
        self.borrower_profile = self.project.borrower
        self.product = application.product
        self.lender = application.lender
    
    def build(self) -> Dict[str, Any]:
        """Build complete report input JSON."""
        return {
            'meta': self._build_meta(),
            'company': self._build_company_data(),
            'directors_shareholders': self._build_directors_shareholders(),
            'applicants_guarantors': self._build_applicants_guarantors(),
            'financial_overview': self._build_financial_overview(),
            'bank_data': self._build_bank_data(),
            'funding_requirement': self._build_funding_requirement(),
            'project_data': self._build_project_data(),
            'documents_index': self._build_documents_index(),
            'derived_metrics': self._build_derived_metrics(),
            'data_completeness': self._build_data_completeness(),
        }
    
    def _build_meta(self) -> Dict[str, Any]:
        """Build metadata section."""
        return {
            'application_id': self.application.id,
            'application_status': self.application.status,
            'submitted_at': self.application.created_at.isoformat() if self.application.created_at else None,
            'lender_name': self.lender.organisation_name,
            'product_name': self.product.name if hasattr(self.product, 'name') else 'N/A',
            'report_generated_at': timezone.now().isoformat(),
        }
    
    def _build_company_data(self) -> Dict[str, Any]:
        """Build company information from Borrower Profile."""
        company_data = {}
        
        # Try to get Companies House data
        try:
            company_ch = getattr(self.borrower_profile, 'company_data', None)
            if company_ch:
                company_data = {
                    'company_name': company_ch.company_name,
                    'company_number': company_ch.company_number,
                    'company_status': company_ch.company_status,
                    'incorporation_date': company_ch.incorporation_date.isoformat() if company_ch.incorporation_date else None,
                    'company_type': company_ch.company_type,
                    'sic_codes': company_ch.sic_codes or [],
                    'registered_address': company_ch.registered_address or {},
                    'trading_address': company_ch.trading_address or {},
                    'is_confirmed': company_ch.is_confirmed,
                }
        except:
            pass
        
        # Fallback to legacy fields
        if not company_data.get('company_name'):
            company_data['company_name'] = self.borrower_profile.company_name or 'Not provided'
            company_data['registration_number'] = self.borrower_profile.registration_number or 'Not provided'
        
        return company_data
    
    def _build_directors_shareholders(self) -> List[Dict[str, Any]]:
        """Build directors and shareholders list."""
        persons = []
        
        try:
            company_data = getattr(self.borrower_profile, 'company_data', None)
            if company_data:
                company_persons = getattr(company_data, 'persons', None)
                if company_persons:
                    for person in company_persons.all():
                        persons.append({
                            'name': person.name,
                            'role': person.role,
                            'ownership_percentage': float(person.ownership_percentage) if person.ownership_percentage else None,
                            'is_applicant_required': person.is_applicant_required,
                            'is_confirmed': person.is_confirmed,
                            'date_of_birth': person.date_of_birth.isoformat() if person.date_of_birth else None,
                            'nationality': person.nationality or 'Not provided',
                        })
        except:
            pass
        
        return persons if persons else []
    
    def _build_applicants_guarantors(self) -> List[Dict[str, Any]]:
        """Build applicants and guarantors list."""
        applicants = []
        
        try:
            # Get applicants from Borrower Profile wizard data
            wizard_data = self.borrower_profile.wizard_data or {}
            applicants_data = wizard_data.get('applicant_details', {})
            
            # Also try to get from ApplicantPersonalDetails model
            from borrowers.models_borrower_profile import ApplicantPersonalDetails
            applicant_records = ApplicantPersonalDetails.objects.filter(
                borrower=self.borrower_profile
            )
            
            for applicant in applicant_records:
                applicants.append({
                    'name': f"{applicant.first_name} {applicant.last_name}".strip() or 'Not provided',
                    'date_of_birth': applicant.date_of_birth.isoformat() if applicant.date_of_birth else None,
                    'nationality': applicant.nationality or 'Not provided',
                    'employment_status': applicant.employment_status or 'Not provided',
                    'occupation': applicant.occupation or 'Not provided',
                    'net_monthly_income': float(applicant.net_monthly_income) if applicant.net_monthly_income else None,
                    'employment_start_date': applicant.employment_start_date.isoformat() if applicant.employment_start_date else None,
                    'address_history': applicant.address_history or [],
                    'borrower_experience_tier': applicant.borrower_experience_tier or 'Not provided',
                    'adverse_credit_band': applicant.adverse_credit_band or 'Not provided',
                    'source_of_deposit': applicant.source_of_deposit or 'Not provided',
                    'intended_exit_strategy': applicant.intended_exit_strategy or 'Not provided',
                })
        except Exception as e:
            # If model doesn't exist or error, continue
            pass
        
        return applicants if applicants else []
    
    def _build_financial_overview(self) -> Dict[str, Any]:
        """Build financial overview from Borrower Profile."""
        financial = {
            'mode': 'not_provided',
            'total_income': None,
            'total_expenditure': None,
            'total_assets': None,
            'total_liabilities': None,
            'net_worth': None,
            'detailed_breakdown': None,
        }
        
        try:
            wizard_data = self.borrower_profile.wizard_data or {}
            financial_data = wizard_data.get('financial_snapshot', {})
            
            if financial_data:
                financial['mode'] = financial_data.get('mode', 'not_provided')
                financial['total_income'] = float(financial_data.get('total_income', 0)) if financial_data.get('total_income') else None
                financial['total_expenditure'] = float(financial_data.get('total_expenditure', 0)) if financial_data.get('total_expenditure') else None
                financial['total_assets'] = float(financial_data.get('total_assets', 0)) if financial_data.get('total_assets') else None
                financial['total_liabilities'] = float(financial_data.get('total_liabilities', 0)) if financial_data.get('total_liabilities') else None
                
                if financial['total_assets'] and financial['total_liabilities']:
                    financial['net_worth'] = financial['total_assets'] - financial['total_liabilities']
                
                if financial['mode'] == 'detailed':
                    financial['detailed_breakdown'] = financial_data.get('breakdown', {})
        except:
            pass
        
        return financial
    
    def _build_bank_data(self) -> Dict[str, Any]:
        """Build bank data summary."""
        bank_data = {
            'method': 'not_provided',
            'open_banking': None,
            'pdf_statements': None,
        }
        
        try:
            wizard_data = self.borrower_profile.wizard_data or {}
            bank_wizard_data = wizard_data.get('bank_data', {})
            
            if bank_wizard_data.get('method') == 'open_banking':
                # Try to get from OpenBankingConnection model
                from borrowers.models_borrower_profile import OpenBankingConnection
                try:
                    ob_connection = OpenBankingConnection.objects.filter(
                        borrower=self.borrower_profile,
                        is_active=True
                    ).first()
                    
                    if ob_connection:
                        bank_data['method'] = 'open_banking'
                        bank_data['open_banking'] = {
                            'provider': ob_connection.provider or 'Not provided',
                            'accounts_count': len(ob_connection.account_ids or []),
                            'total_balance': float(ob_connection.total_balance) if ob_connection.total_balance else None,
                            'last_sync_date': ob_connection.last_sync_date.isoformat() if ob_connection.last_sync_date else None,
                            'inflow_average': float(ob_connection.transaction_summaries.get('inflow_average', 0)) if ob_connection.transaction_summaries else None,
                            'outflow_average': float(ob_connection.transaction_summaries.get('outflow_average', 0)) if ob_connection.transaction_summaries else None,
                            'has_overdraft': ob_connection.transaction_summaries.get('has_overdraft', False) if ob_connection.transaction_summaries else False,
                        }
                except:
                    pass
            elif bank_wizard_data.get('method') == 'pdf_upload':
                bank_data['method'] = 'pdf_upload'
                bank_data['pdf_statements'] = {
                    'statements_uploaded': bank_wizard_data.get('statements_count', 0),
                    'coverage_months': bank_wizard_data.get('coverage_months', []),
                }
        except:
            pass
        
        return bank_data
    
    def _build_funding_requirement(self) -> Dict[str, Any]:
        """Build funding requirement details."""
        return {
            'loan_amount': float(self.application.proposed_loan_amount),
            'term_months': self.application.proposed_term_months,
            'interest_rate': float(self.application.proposed_interest_rate) if self.application.proposed_interest_rate else None,
            'ltv_ratio': float(self.application.proposed_ltv_ratio) if self.application.proposed_ltv_ratio else None,
            'product_type': self.product.funding_type if hasattr(self.product, 'funding_type') else 'Not provided',
            'repayment_method': self.product.repayment_method if hasattr(self.product, 'repayment_method') else 'Not provided',
            'security_type': self.product.security_required if hasattr(self.product, 'security_required') else 'Not provided',
            'notes': self.application.notes or '',
        }
    
    def _build_project_data(self) -> Dict[str, Any]:
        """Build linked project data (read-only)."""
        if not self.project:
            return {}
        
        return {
            'project_id': self.project.id,
            'description': self.project.description or 'Not provided',
            'funding_type': self.project.funding_type if hasattr(self.project, 'funding_type') else 'Not provided',
            'property_address': self.project.property_address or {} if hasattr(self.project, 'property_address') else {},
            'purchase_price': float(self.project.purchase_price) if hasattr(self.project, 'purchase_price') and self.project.purchase_price else None,
            'estimated_value': float(self.project.estimated_value) if hasattr(self.project, 'estimated_value') and self.project.estimated_value else None,
            'loan_amount_requested': float(self.project.loan_amount_requested) if hasattr(self.project, 'loan_amount_requested') and self.project.loan_amount_requested else None,
            'term_required_months': self.project.term_required_months if hasattr(self.project, 'term_required_months') else None,
        }
    
    def _build_documents_index(self) -> List[Dict[str, Any]]:
        """Build documents index (metadata only)."""
        documents = []
        
        try:
            from documents.models import Document
            from applications.models import ApplicationDocument
            
            # Get documents linked to this application
            app_docs = ApplicationDocument.objects.filter(application=self.application).select_related('document', 'document__document_type')
            
            for app_doc in app_docs:
                doc = app_doc.document
                documents.append({
                    'name': doc.file_name or 'Unknown',
                    'type': doc.document_type.name if doc.document_type else 'Unknown',
                    'category': doc.document_type.category if doc.document_type else 'Unknown',
                    'uploaded_at': doc.created_at.isoformat() if doc.created_at else None,
                    'size_bytes': doc.file_size if hasattr(doc, 'file_size') else None,
                })
        except:
            pass
        
        return documents
    
    def _build_derived_metrics(self) -> Dict[str, Any]:
        """Calculate derived financial metrics."""
        metrics = {
            'ltv': None,
            'ltc': None,
            'dscr': None,
            'icr': None,
            'net_worth': None,
        }
        
        try:
            # LTV (Loan-to-Value)
            if self.application.proposed_ltv_ratio:
                metrics['ltv'] = float(self.application.proposed_ltv_ratio)
            elif hasattr(self.project, 'estimated_value') and self.project.estimated_value:
                loan_amount = float(self.application.proposed_loan_amount)
                property_value = float(self.project.estimated_value)
                if property_value > 0:
                    metrics['ltv'] = (loan_amount / property_value) * 100
            
            # LTC (Loan-to-Cost)
            if hasattr(self.project, 'purchase_price') and self.project.purchase_price:
                loan_amount = float(self.application.proposed_loan_amount)
                purchase_price = float(self.project.purchase_price)
                if purchase_price > 0:
                    metrics['ltc'] = (loan_amount / purchase_price) * 100
            
            # Net Worth
            financial = self._build_financial_overview()
            if financial.get('net_worth') is not None:
                metrics['net_worth'] = financial['net_worth']
            
            # DSCR/ICR would require more detailed income/expenditure data
            # This is a placeholder for future enhancement
        except:
            pass
        
        return metrics
    
    def _build_data_completeness(self) -> Dict[str, Any]:
        """Build data completeness indicators."""
        completeness = {
            'company_data': False,
            'directors_shareholders': False,
            'applicants': False,
            'financial_data': False,
            'bank_data': False,
            'documents': False,
            'project_data': False,
        }
        
        # Check company data
        company = self._build_company_data()
        completeness['company_data'] = bool(company.get('company_name') and company.get('company_name') != 'Not provided')
        
        # Check directors/shareholders
        directors = self._build_directors_shareholders()
        completeness['directors_shareholders'] = len(directors) > 0
        
        # Check applicants
        applicants = self._build_applicants_guarantors()
        completeness['applicants'] = len(applicants) > 0
        
        # Check financial data
        financial = self._build_financial_overview()
        completeness['financial_data'] = financial.get('mode') != 'not_provided'
        
        # Check bank data
        bank = self._build_bank_data()
        completeness['bank_data'] = bank.get('method') != 'not_provided'
        
        # Check documents
        docs = self._build_documents_index()
        completeness['documents'] = len(docs) > 0
        
        # Check project data
        project = self._build_project_data()
        completeness['project_data'] = bool(project.get('description') and project.get('description') != 'Not provided')
        
        return completeness
