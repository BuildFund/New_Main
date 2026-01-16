"""
Script to create ProviderEnquiry test data for consultants with comprehensive deal summary snapshots.
Run with: python manage.py shell < create_provider_enquiry_test_data.py
Or: python manage.py shell, then copy-paste this code
"""

import os
import django
from datetime import datetime, timedelta
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'buildfund_app.settings')
django.setup()

from django.contrib.auth.models import User
from deals.models import Deal, ProviderEnquiry
from consultants.models import ConsultantProfile
from applications.models import Application

print("=" * 60)
print("Creating ProviderEnquiry test data with comprehensive deal summaries...")
print("=" * 60)

def get_loan_amount_range(amount):
    """Convert exact loan amount to privacy-preserving range."""
    if not amount:
        return None
    try:
        amount_float = float(amount)
        if amount_float < 100000:
            return '< £100k'
        elif amount_float < 500000:
            return '£100k - £500k'
        elif amount_float < 1000000:
            return '£500k - £1M'
        elif amount_float < 5000000:
            return '£1M - £5M'
        else:
            return '£5M+'
    except (ValueError, TypeError):
        return None

def get_ltv_range(ltv):
    """Convert exact LTV to privacy-preserving range."""
    if not ltv:
        return None
    try:
        ltv_float = float(ltv)
        if ltv_float < 50:
            return '< 50%'
        elif ltv_float < 65:
            return '50-65%'
        elif ltv_float < 75:
            return '65-75%'
        else:
            return '75%+'
    except (ValueError, TypeError):
        return None

def get_interest_rate_range(rate):
    """Convert exact interest rate to privacy-preserving range."""
    if not rate:
        return None
    try:
        rate_float = float(rate)
        if rate_float < 5:
            return '< 5%'
        elif rate_float < 8:
            return '5-8%'
        elif rate_float < 12:
            return '8-12%'
        else:
            return '12%+'
    except (ValueError, TypeError):
        return None

def get_borrower_experience_summary(borrower):
    """Get anonymized borrower experience summary."""
    if not borrower:
        return None
    summary = {}
    if hasattr(borrower, 'company_data') and borrower.company_data:
        incorporation_date = borrower.company_data.get('date_of_creation')
        if incorporation_date:
            try:
                inc_date = datetime.fromisoformat(incorporation_date.replace('Z', '+00:00'))
                years = (timezone.now() - inc_date).days / 365.25
                if years < 2:
                    summary['experience_level'] = 'New/Start-up'
                elif years < 5:
                    summary['experience_level'] = '2-5 years'
                elif years < 10:
                    summary['experience_level'] = '5-10 years'
                else:
                    summary['experience_level'] = '10+ years'
            except (ValueError, TypeError, AttributeError):
                pass
    if not summary.get('experience_level') and hasattr(borrower, 'experience_description') and borrower.experience_description:
        summary['has_experience_description'] = True
    return summary if summary else None

def build_comprehensive_deal_summary(deal):
    """Build comprehensive deal summary snapshot (same logic as request_quotes endpoint)."""
    project = deal.application.project if deal.application and deal.application.project else None
    borrower = deal.borrower_company
    lender = deal.lender
    product = deal.application.product if deal.application and deal.application.product else None
    application = deal.application if deal.application else None
    
    # Get commercial terms from deal or application
    commercial_terms = deal.commercial_terms if deal.commercial_terms else {}
    if application:
        if not commercial_terms.get('loan_amount'):
            commercial_terms['loan_amount'] = float(application.proposed_loan_amount) if application.proposed_loan_amount else None
        if not commercial_terms.get('term_months'):
            commercial_terms['term_months'] = application.proposed_term_months
        if not commercial_terms.get('ltv_ratio'):
            commercial_terms['ltv_ratio'] = float(application.proposed_ltv_ratio) if application.proposed_ltv_ratio else None
        if not commercial_terms.get('interest_rate'):
            commercial_terms['interest_rate'] = float(application.proposed_interest_rate) if application.proposed_interest_rate else None
    
    deal_summary = {
        'deal_id': deal.deal_id,
        'facility_type': deal.facility_type,
        'facility_type_display': deal.get_facility_type_display(),
        'jurisdiction': deal.jurisdiction,
        'deal_status': deal.status,
        'deal_status_display': deal.get_status_display() if hasattr(deal, 'get_status_display') else deal.status,
        
        # Project information (comprehensive but non-sensitive)
        'project': {
            'property_type': project.property_type if project else None,
            'property_type_display': project.get_property_type_display() if project and hasattr(project, 'get_property_type_display') else None,
            'description': project.description if project else None,
            'address': project.address if project else None,
            'town': project.town if project else None,
            'county': project.county if project else None,
            'postcode': project.postcode if project else None,
            'development_extent': project.development_extent if project else None,
            'development_extent_display': project.get_development_extent_display() if project and hasattr(project, 'get_development_extent_display') else None,
            'tenure': project.tenure if project else None,
            'tenure_display': project.get_tenure_display() if project and hasattr(project, 'get_tenure_display') else None,
            'planning_permission': project.planning_permission if project else None,
            'planning_authority': project.planning_authority if project else None,
            'planning_reference': project.planning_reference if project else None,
            'planning_description': project.planning_description if project else None,
            'unit_counts': project.unit_counts if project and hasattr(project, 'unit_counts') and project.unit_counts else {},
            'gross_internal_area': float(project.gross_internal_area) if project and project.gross_internal_area else None,
            'purchase_price': float(project.purchase_price) if project and project.purchase_price else None,
            'purchase_costs': float(project.purchase_costs) if project and project.purchase_costs else None,
            'build_cost': float(project.build_cost) if project and project.build_cost else None,
            'current_market_value': float(project.current_market_value) if project and project.current_market_value else None,
            'gross_development_value': float(project.gross_development_value) if project and project.gross_development_value else None,
            'repayment_method': project.repayment_method if project else None,
            'repayment_method_display': project.get_repayment_method_display() if project and hasattr(project, 'get_repayment_method_display') else None,
            'term_required_months': project.term_required_months if project else None,
            'funding_type': project.funding_type if project else None,
            'funding_type_display': project.get_funding_type_display() if project and hasattr(project, 'get_funding_type_display') else None,
        } if project else {},
        
        # Borrower company information (non-sensitive - company info only, no personal data)
        'borrower': {
            'company_name': borrower.company_name if borrower else None,
            'trading_name': borrower.trading_name if borrower else None,
            'company_type': borrower.company_data.get('company_type') if borrower and hasattr(borrower, 'company_data') and borrower.company_data else None,
            'company_type_display': borrower.company_data.get('company_type') if borrower and hasattr(borrower, 'company_data') and borrower.company_data else None,
            'experience_summary': get_borrower_experience_summary(borrower),
        } if borrower else {},
        
        # Lender information (comprehensive public info)
        'lender': {
            'organisation_name': lender.organisation_name if lender else None,
            'contact_email': lender.contact_email if lender else None,
            'contact_phone': lender.contact_phone if lender else None,
            'website': lender.website if lender else None,
            'description': lender.description[:500] if lender and hasattr(lender, 'description') and lender.description else None,
        } if lender else {},
        
        # Product information (comprehensive product details)
        'product': {
            'name': product.name if product else None,
            'funding_type': product.funding_type if product else None,
            'funding_type_display': product.get_funding_type_display() if product and hasattr(product, 'get_funding_type_display') else None,
            'description': product.description[:1000] if product and product.description else None,
            'property_type': product.property_type if product else None,
            'property_type_display': product.get_property_type_display() if product and hasattr(product, 'get_property_type_display') else None,
            'repayment_structure': product.repayment_structure if product else None,
            'repayment_structure_display': product.get_repayment_structure_display() if product and hasattr(product, 'get_repayment_structure_display') else None,
            'min_loan_amount': float(product.min_loan_amount) if product and product.min_loan_amount else None,
            'max_loan_amount': float(product.max_loan_amount) if product and product.max_loan_amount else None,
            'interest_rate_min': float(product.interest_rate_min) if product and product.interest_rate_min else None,
            'interest_rate_max': float(product.interest_rate_max) if product and product.interest_rate_max else None,
            'term_min_months': product.term_min_months if product else None,
            'term_max_months': product.term_max_months if product else None,
            'max_ltv_ratio': float(product.max_ltv_ratio) if product and product.max_ltv_ratio else None,
            'eligibility_criteria': product.eligibility_criteria[:1000] if product and product.eligibility_criteria else None,
        } if product else {},
        
        # Application terms (proposed terms for this deal)
        'application_terms': {
            'proposed_loan_amount_range': get_loan_amount_range(commercial_terms.get('loan_amount')),
            'proposed_term_months': commercial_terms.get('term_months'),
            'proposed_ltv_range': get_ltv_range(commercial_terms.get('ltv_ratio')),
            'proposed_interest_rate_range': get_interest_rate_range(commercial_terms.get('interest_rate')),
        } if commercial_terms else {},
        
        # Deal commercial terms (ranges/indicators only, not exact amounts)
        'commercial_indicators': {
            'loan_amount_range': get_loan_amount_range(commercial_terms.get('loan_amount')),
            'term_months': commercial_terms.get('term_months'),
            'ltv_range': get_ltv_range(commercial_terms.get('ltv_ratio')),
            'interest_rate_range': get_interest_rate_range(commercial_terms.get('interest_rate')),
            'repayment_structure': commercial_terms.get('repayment_structure'),
        } if commercial_terms else {},
        
        # Security structure (non-sensitive - structure only, not exact details)
        'security_structure': {
            'primary_security': 'Property' if project else 'Not specified',
            'security_type': 'First charge' if deal.facility_type in ['development', 'term'] else 'Not specified',
        },
        
        # Transaction structure (for solicitors - comprehensive)
        'transaction_structure': {
            'borrower_entity_type': borrower.company_data.get('company_type') if borrower and hasattr(borrower, 'company_data') and borrower.company_data else None,
            'borrower_entity_type_display': borrower.company_data.get('company_type') if borrower and hasattr(borrower, 'company_data') and borrower.company_data else None,
            'deal_structure': deal.facility_type,
            'deal_structure_display': deal.get_facility_type_display(),
            'jurisdiction': deal.jurisdiction,
            'transaction_type': 'Development Finance' if deal.facility_type == 'development' else 'Term Loan' if deal.facility_type == 'term' else 'Bridge Finance',
            'security_type': 'First charge on property',
            'complexity_indicators': {
                'has_multiple_securities': False,
                'has_guarantees': False,
                'has_intercreditor': deal.facility_type == 'development',
                'requires_planning_condition_satisfaction': project.planning_permission if project else False,
            },
            'expected_completion_timeline': commercial_terms.get('term_months'),
        },
    }
    
    return deal_summary

# Get consultant users
consultant1 = User.objects.filter(username='consultant1').first()
consultant1_profile = ConsultantProfile.objects.filter(user=consultant1).first() if consultant1 else None

solicitor1 = User.objects.filter(username='solicitor1').first()
solicitor1_profile = ConsultantProfile.objects.filter(user=solicitor1).first() if solicitor1 else None

# Get deals (accepted applications that have deals)
deals = Deal.objects.all()[:3]  # Get up to 3 deals

if not deals.exists():
    print("No deals found. Please create some deals first by accepting applications.")
    exit()

print(f"\nFound {deals.count()} deal(s)")

# Create enquiries for different consultants and roles
enquiries_created = 0
enquiries_updated = 0

for deal in deals:
    # Build comprehensive deal summary
    deal_summary = build_comprehensive_deal_summary(deal)
    
    # Create enquiry for consultant1 (Valuer)
    if consultant1_profile:
        enquiry, created = ProviderEnquiry.objects.get_or_create(
            deal=deal,
            role_type='valuer',
            provider_firm=consultant1_profile,
            defaults={
                'status': 'sent',
                'quote_due_at': timezone.now() + timedelta(days=7),
                'deal_summary_snapshot': deal_summary,
                'lender_notes': 'Please provide a comprehensive valuation report for this development project.',
            }
        )
        if created:
            enquiries_created += 1
            print(f"  ✓ Created Valuer enquiry for consultant1 on deal {deal.deal_id}")
        else:
            # Update existing enquiry with comprehensive snapshot
            enquiry.deal_summary_snapshot = deal_summary
            enquiry.save()
            enquiries_updated += 1
            print(f"  ↻ Updated Valuer enquiry for consultant1 on deal {deal.deal_id} with comprehensive snapshot")

    # Create enquiry for solicitor1 (Solicitor)
    if solicitor1_profile:
        enquiry, created = ProviderEnquiry.objects.get_or_create(
            deal=deal,
            role_type='solicitor',
            provider_firm=solicitor1_profile,
            defaults={
                'status': 'sent',
                'quote_due_at': timezone.now() + timedelta(days=10),
                'deal_summary_snapshot': deal_summary,
                'lender_notes': 'Legal services required for this transaction. Please provide quote for conveyancing and completion services.',
            }
        )
        if created:
            enquiries_created += 1
            print(f"  ✓ Created Solicitor enquiry for solicitor1 on deal {deal.deal_id}")
        else:
            # Update existing enquiry with comprehensive snapshot
            enquiry.deal_summary_snapshot = deal_summary
            enquiry.save()
            enquiries_updated += 1
            print(f"  ↻ Updated Solicitor enquiry for solicitor1 on deal {deal.deal_id} with comprehensive snapshot")

    # Create a Monitoring Surveyor enquiry for consultant1 if they offer that service
    if consultant1_profile and consultant1_profile.primary_service in ['valuation_and_monitoring_surveyor', 'monitoring_surveyor']:
        enquiry, created = ProviderEnquiry.objects.get_or_create(
            deal=deal,
            role_type='monitoring_surveyor',
            provider_firm=consultant1_profile,
            defaults={
                'status': 'viewed',  # One already viewed
                'viewed_at': timezone.now() - timedelta(hours=2),
                'quote_due_at': timezone.now() + timedelta(days=5),
                'deal_summary_snapshot': deal_summary,
                'lender_notes': 'Monitoring surveyor services required for ongoing project monitoring.',
            }
        )
        if created:
            enquiries_created += 1
            print(f"  ✓ Created Monitoring Surveyor enquiry for consultant1 on deal {deal.deal_id}")
        else:
            # Update existing enquiry with comprehensive snapshot
            enquiry.deal_summary_snapshot = deal_summary
            enquiry.save()
            enquiries_updated += 1
            print(f"  ↻ Updated Monitoring Surveyor enquiry for consultant1 on deal {deal.deal_id} with comprehensive snapshot")

print(f"\n{'=' * 60}")
print(f"Created {enquiries_created} new ProviderEnquiry record(s)")
print(f"Updated {enquiries_updated} existing ProviderEnquiry record(s) with comprehensive snapshots")
print(f"{'=' * 60}")
