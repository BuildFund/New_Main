"""
Script to create ProviderEnquiry test data for consultants.
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
print("Creating ProviderEnquiry test data...")
print("=" * 60)

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

for deal in deals:
    # Create enquiry for consultant1 (Valuer)
    if consultant1_profile:
        enquiry, created = ProviderEnquiry.objects.get_or_create(
            deal=deal,
            role_type='valuer',
            provider_firm=consultant1_profile,
            defaults={
                'status': 'sent',
                'quote_due_at': timezone.now() + timedelta(days=7),
                'deal_summary_snapshot': {
                    'deal_id': deal.deal_id,
                    'facility_type': deal.facility_type,
                    'facility_type_display': deal.get_facility_type_display(),
                    'jurisdiction': deal.jurisdiction,
                    'project': {
                        'property_type': deal.application.project.property_type if deal.application and deal.application.project else None,
                        'property_type_display': deal.application.project.get_property_type_display() if deal.application and deal.application.project else None,
                        'description': deal.application.project.description if deal.application and deal.application.project else None,
                        'address': deal.application.project.address if deal.application and deal.application.project else None,
                        'town': deal.application.project.town if deal.application and deal.application.project else None,
                        'county': deal.application.project.county if deal.application and deal.application.project else None,
                        'postcode': deal.application.project.postcode if deal.application and deal.application.project else None,
                    } if deal.application and deal.application.project else {},
                    'borrower': {
                        'company_name': deal.borrower_company.company_name if deal.borrower_company else None,
                        'trading_name': deal.borrower_company.trading_name if deal.borrower_company else None,
                    } if deal.borrower_company else {},
                    'lender': {
                        'organisation_name': deal.lender.organisation_name if deal.lender else None,
                        'contact_email': deal.lender.contact_email if deal.lender else None,
                    } if deal.lender else {},
                },
                'lender_notes': 'Please provide a comprehensive valuation report for this development project.',
            }
        )
        if created:
            enquiries_created += 1
            print(f"  ✓ Created Valuer enquiry for consultant1 on deal {deal.deal_id}")

    # Create enquiry for solicitor1 (Solicitor)
    if solicitor1_profile:
        enquiry, created = ProviderEnquiry.objects.get_or_create(
            deal=deal,
            role_type='solicitor',
            provider_firm=solicitor1_profile,
            defaults={
                'status': 'sent',
                'quote_due_at': timezone.now() + timedelta(days=10),
                'deal_summary_snapshot': {
                    'deal_id': deal.deal_id,
                    'facility_type': deal.facility_type,
                    'facility_type_display': deal.get_facility_type_display(),
                    'jurisdiction': deal.jurisdiction,
                    'project': {
                        'property_type': deal.application.project.property_type if deal.application and deal.application.project else None,
                        'property_type_display': deal.application.project.get_property_type_display() if deal.application and deal.application.project else None,
                        'description': deal.application.project.description if deal.application and deal.application.project else None,
                        'address': deal.application.project.address if deal.application and deal.application.project else None,
                        'town': deal.application.project.town if deal.application and deal.application.project else None,
                        'county': deal.application.project.county if deal.application and deal.application.project else None,
                        'postcode': deal.application.project.postcode if deal.application and deal.application.project else None,
                    } if deal.application and deal.application.project else {},
                    'borrower': {
                        'company_name': deal.borrower_company.company_name if deal.borrower_company else None,
                        'trading_name': deal.borrower_company.trading_name if deal.borrower_company else None,
                    } if deal.borrower_company else {},
                    'lender': {
                        'organisation_name': deal.lender.organisation_name if deal.lender else None,
                        'contact_email': deal.lender.contact_email if deal.lender else None,
                    } if deal.lender else {},
                },
                'lender_notes': 'Legal services required for this transaction. Please provide quote for conveyancing and completion services.',
            }
        )
        if created:
            enquiries_created += 1
            print(f"  ✓ Created Solicitor enquiry for solicitor1 on deal {deal.deal_id}")

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
                'deal_summary_snapshot': {
                    'deal_id': deal.deal_id,
                    'facility_type': deal.facility_type,
                    'facility_type_display': deal.get_facility_type_display(),
                    'jurisdiction': deal.jurisdiction,
                    'project': {
                        'property_type': deal.application.project.property_type if deal.application and deal.application.project else None,
                        'property_type_display': deal.application.project.get_property_type_display() if deal.application and deal.application.project else None,
                        'description': deal.application.project.description if deal.application and deal.application.project else None,
                        'address': deal.application.project.address if deal.application and deal.application.project else None,
                        'town': deal.application.project.town if deal.application and deal.application.project else None,
                        'county': deal.application.project.county if deal.application and deal.application.project else None,
                        'postcode': deal.application.project.postcode if deal.application and deal.application.project else None,
                    } if deal.application and deal.application.project else {},
                    'borrower': {
                        'company_name': deal.borrower_company.company_name if deal.borrower_company else None,
                        'trading_name': deal.borrower_company.trading_name if deal.borrower_company else None,
                    } if deal.borrower_company else {},
                    'lender': {
                        'organisation_name': deal.lender.organisation_name if deal.lender else None,
                        'contact_email': deal.lender.contact_email if deal.lender else None,
                    } if deal.lender else {},
                },
                'lender_notes': 'Monitoring surveyor services required for ongoing project monitoring.',
            }
        )
        if created:
            enquiries_created += 1
            print(f"  ✓ Created Monitoring Surveyor enquiry for consultant1 on deal {deal.deal_id}")

print(f"\n{'=' * 60}")
print(f"Created {enquiries_created} ProviderEnquiry record(s)")
print(f"{'=' * 60}")
