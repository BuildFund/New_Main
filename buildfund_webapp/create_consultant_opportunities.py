"""Create test service opportunities for different consultant types."""
import os
import django
from datetime import datetime, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'buildfund_app.settings')
django.setup()

from django.contrib.auth.models import User
from applications.models import Application
from consultants.models import ConsultantService
from projects.models import Project
from borrowers.models import BorrowerProfile
from lenders.models import LenderProfile
from products.models import Product

def create_consultant_opportunities():
    """Create test service opportunities for different consultant types."""
    
    # Get or create test borrower and lender
    borrower_user, _ = User.objects.get_or_create(
        username='borrower1',
        defaults={'email': 'borrower1@test.com', 'is_active': True}
    )
    borrower_profile, _ = BorrowerProfile.objects.get_or_create(
        user=borrower_user,
        defaults={'company_name': 'Test Borrower Ltd'}
    )
    
    lender_user, _ = User.objects.get_or_create(
        username='lender1',
        defaults={'email': 'lender1@test.com', 'is_active': True}
    )
    lender_profile, _ = LenderProfile.objects.get_or_create(
        user=lender_user,
        defaults={'company_name': 'Test Lender Ltd'}
    )
    
    # Get first product for lender, or create one
    product = Product.objects.filter(lender=lender_profile).first()
    if not product:
        product = Product.objects.create(
            lender=lender_profile,
            name='Test Development Finance Product',
            funding_type='development_finance',
            property_type='residential',
            min_loan_amount=100000,
            max_loan_amount=5000000,
            min_ltv=50,
            max_ltv=75,
            is_active=True,
        )
    
    # Use existing accepted applications or create minimal ones
    applications = list(Application.objects.filter(status='accepted')[:4])
    
    if len(applications) < 4:
        # Create test projects if needed
        projects_data = [
            {
                'description': 'Residential Development - London',
                'address': '123 Test Street',
                'town': 'London',
                'county': 'Greater London',
                'postcode': 'SW1A 1AA',
                'property_type': 'residential',
                'funding_type': 'development_finance',
            },
            {
                'description': 'Commercial Property - Manchester',
                'address': '456 Business Road',
                'town': 'Manchester',
                'county': 'Greater Manchester',
                'postcode': 'M1 1AA',
                'property_type': 'commercial',
                'funding_type': 'commercial_mortgage',
            },
            {
                'description': 'Mixed Use Development - Birmingham',
                'address': '789 Mixed Avenue',
                'town': 'Birmingham',
                'county': 'West Midlands',
                'postcode': 'B1 1AA',
                'property_type': 'mixed',
                'funding_type': 'development_finance',
            },
            {
                'description': 'Industrial Unit - Leeds',
                'address': '321 Industrial Way',
                'town': 'Leeds',
                'county': 'West Yorkshire',
                'postcode': 'LS1 1AA',
                'property_type': 'industrial',
                'funding_type': 'commercial_mortgage',
            },
        ]
        
        for i, proj_data in enumerate(projects_data):
            if i >= len(applications):
                project, _ = Project.objects.get_or_create(
                    borrower=borrower_profile,
                    description=proj_data['description'],
                    defaults={
                        'address': proj_data['address'],
                        'town': proj_data['town'],
                        'county': proj_data['county'],
                        'postcode': proj_data['postcode'],
                        'property_type': proj_data['property_type'],
                        'funding_type': proj_data['funding_type'],
                        'loan_amount_required': 1000000,
                        'repayment_method': 'sale',
                    }
                )
                application, _ = Application.objects.get_or_create(
                    project=project,
                    lender=lender_profile,
                    product=product,
                    defaults={
                        'status': 'accepted',
                        'proposed_loan_amount': 1000000,
                        'proposed_term_months': 24,
                        'proposed_interest_rate': 5.5,
                    }
                )
                applications.append(application)
    
    # Create service opportunities for different consultant types
    opportunities = [
        # Valuation & Monitoring Surveyor opportunities
        {
            'application': applications[0],  # London project
            'service_type': 'valuation_and_monitoring_surveyor',
            'description': 'Full valuation and monitoring surveyor services required for residential development in London',
            'geographic_requirement': 'Greater London',
            'required_qualifications': ['rics_monitoring', 'rics_valuation', 'rics'],
            'minimum_experience_years': 5,
        },
        {
            'application': applications[1],  # Manchester project
            'service_type': 'valuation_and_monitoring_surveyor',
            'description': 'Valuation and monitoring surveyor needed for commercial property development',
            'geographic_requirement': 'Greater Manchester',
            'required_qualifications': ['rics_monitoring', 'rics_valuation'],
            'minimum_experience_years': 3,
        },
        
        # Monitoring Surveyor only opportunities
        {
            'application': applications[2],  # Birmingham project
            'service_type': 'monitoring_surveyor',
            'description': 'Monitoring surveyor required for mixed-use development project',
            'geographic_requirement': 'West Midlands',
            'required_qualifications': ['rics_monitoring', 'rics'],
            'minimum_experience_years': 3,
        },
        {
            'application': applications[3],  # Leeds project
            'service_type': 'monitoring_surveyor',
            'description': 'Monitoring surveyor needed for industrial unit development',
            'geographic_requirement': 'West Yorkshire',
            'required_qualifications': ['rics_monitoring'],
            'minimum_experience_years': 2,
        },
        
        # Valuation Surveyor only opportunities
        {
            'application': applications[0],  # London project
            'service_type': 'valuation_surveyor',
            'description': 'Property valuation required for loan security assessment',
            'geographic_requirement': 'Greater London',
            'required_qualifications': ['rics_valuation', 'rics'],
            'minimum_experience_years': 5,
        },
        {
            'application': applications[1],  # Manchester project
            'service_type': 'valuation_surveyor',
            'description': 'Commercial property valuation needed',
            'geographic_requirement': 'Greater Manchester',
            'required_qualifications': ['rics_valuation'],
            'minimum_experience_years': 3,
        },
        
        # Solicitor opportunities
        {
            'application': applications[0],  # London project
            'service_type': 'solicitor',
            'description': 'Solicitor required for loan conveyance and legal documentation',
            'geographic_requirement': 'Greater London',
            'required_qualifications': ['sra'],
            'minimum_experience_years': 3,
        },
        {
            'application': applications[2],  # Birmingham project
            'service_type': 'solicitor',
            'description': 'Legal services needed for property transaction',
            'geographic_requirement': 'West Midlands',
            'required_qualifications': ['sra', 'cilex'],
            'minimum_experience_years': 2,
        },
        {
            'application': applications[3],  # Leeds project
            'service_type': 'solicitor',
            'description': 'Solicitor required for development finance legal work',
            'geographic_requirement': 'West Yorkshire',
            'required_qualifications': ['sra'],
            'minimum_experience_years': 3,
        },
    ]
    
    created_count = 0
    for opp_data in opportunities:
        # Check if service already exists
        existing = ConsultantService.objects.filter(
            application=opp_data['application'],
            service_type=opp_data['service_type']
        ).first()
        
        if not existing:
            service = ConsultantService.objects.create(
                application=opp_data['application'],
                service_type=opp_data['service_type'],
                description=opp_data['description'],
                geographic_requirement=opp_data['geographic_requirement'],
                required_qualifications=opp_data['required_qualifications'],
                minimum_experience_years=opp_data['minimum_experience_years'],
                status='pending',
                required_by_date=datetime.now().date() + timedelta(days=30),
            )
            created_count += 1
            print(f"[OK] Created {service.get_service_type_display()} opportunity for Application #{service.application.id} ({service.geographic_requirement})")
        else:
            print(f"[SKIP] Service already exists: {existing.get_service_type_display()} for Application #{existing.application.id}")
    
    print(f"\n[SUCCESS] Created {created_count} new service opportunities")
    print("\nOpportunities by type:")
    for service_type, label in ConsultantService.SERVICE_TYPES:
        count = ConsultantService.objects.filter(service_type=service_type, status='pending').count()
        print(f"  {label}: {count}")

if __name__ == '__main__':
    print("Creating consultant service opportunities...\n")
    create_consultant_opportunities()
