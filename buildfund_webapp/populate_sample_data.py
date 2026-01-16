"""
Django management script to populate the database with sample data for testing.

Run with: python manage.py shell < populate_sample_data.py
Or: python manage.py shell, then copy-paste this code
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'buildfund_app.settings')
django.setup()

from django.contrib.auth.models import User
from accounts.models import Role, UserRole
from borrowers.models import BorrowerProfile
from lenders.models import LenderProfile
from projects.models import Project
from products.models import Product
from applications.models import Application
from messaging.models import Message
from decimal import Decimal
from datetime import date, timedelta

print("=" * 60)
print("Populating BuildFund database with sample data...")
print("=" * 60)

# Get or create roles
admin_role, _ = Role.objects.get_or_create(name="Admin")
borrower_role, _ = Role.objects.get_or_create(name="Borrower")
lender_role, _ = Role.objects.get_or_create(name="Lender")

# Create or get sample borrowers
print("\n1. Creating sample borrowers...")

borrower1, created = User.objects.get_or_create(
    username="borrower1",
    defaults={
        "email": "borrower1@example.com",
        "first_name": "John",
        "last_name": "Smith",
    }
)
if created:
    borrower1.set_password("password123")
    borrower1.save()
    print(f"   Created borrower: {borrower1.username}")
else:
    print(f"   Using existing borrower: {borrower1.username}")

borrower1_profile, _ = BorrowerProfile.objects.get_or_create(
    user=borrower1,
    defaults={
        "first_name": "John",
        "last_name": "Smith",
        "company_name": "Smith Property Developments Ltd",
        "registration_number": "12345678",
        "trading_name": "Smith Developments",
        "phone_number": "+44 20 1234 5678",
        "address_1": "123 Business Street",
        "city": "London",
        "county": "Greater London",
        "postcode": "SW1A 1AA",
        "country": "United Kingdom",
        "experience_description": "10 years experience in residential property development. Completed 15 projects in London and surrounding areas.",
    }
)

UserRole.objects.get_or_create(user=borrower1, role=borrower_role)

borrower2, created = User.objects.get_or_create(
    username="borrower2",
    defaults={
        "email": "borrower2@example.com",
        "first_name": "Sarah",
        "last_name": "Johnson",
    }
)
if created:
    borrower2.set_password("password123")
    borrower2.save()
    print(f"   Created borrower: {borrower2.username}")
else:
    print(f"   Using existing borrower: {borrower2.username}")

borrower2_profile, _ = BorrowerProfile.objects.get_or_create(
    user=borrower2,
    defaults={
        "first_name": "Sarah",
        "last_name": "Johnson",
        "company_name": "Johnson Commercial Properties",
        "registration_number": "87654321",
        "trading_name": "JCP",
        "phone_number": "+44 161 234 5678",
        "address_1": "456 Commercial Road",
        "city": "Manchester",
        "county": "Greater Manchester",
        "postcode": "M1 1AA",
        "country": "United Kingdom",
        "experience_description": "Specialist in commercial property conversions and refurbishments.",
    }
)

UserRole.objects.get_or_create(user=borrower2, role=borrower_role)

# Create or get sample lenders
print("\n2. Creating sample lenders...")

lender1, created = User.objects.get_or_create(
    username="lender1",
    defaults={
        "email": "lender1@example.com",
        "first_name": "David",
        "last_name": "Williams",
    }
)
if created:
    lender1.set_password("password123")
    lender1.save()
    print(f"   Created lender: {lender1.username}")
else:
    print(f"   Using existing lender: {lender1.username}")

lender1_profile, _ = LenderProfile.objects.get_or_create(
    user=lender1,
    defaults={
        "organisation_name": "Prime Development Finance",
        "company_number": "11111111",
        "fca_registration_number": "FCA123456",
        "contact_email": "info@primedevfinance.com",
        "contact_phone": "+44 20 9876 5432",
        "website": "https://www.primedevfinance.com",
        "company_story": "Leading provider of development finance for residential and commercial projects across the UK.",
        "number_of_employees": 50,
        "financial_licences": "FCA Authorised",
        "membership_bodies": "UK Finance, BBA",
    }
)

UserRole.objects.get_or_create(user=lender1, role=lender_role)

lender2, created = User.objects.get_or_create(
    username="lender2",
    defaults={
        "email": "lender2@example.com",
        "first_name": "Emma",
        "last_name": "Brown",
    }
)
if created:
    lender2.set_password("password123")
    lender2.save()
    print(f"   Created lender: {lender2.username}")
else:
    print(f"   Using existing lender: {lender2.username}")

lender2_profile, _ = LenderProfile.objects.get_or_create(
    user=lender2,
    defaults={
        "organisation_name": "Commercial Lending Solutions",
        "company_number": "22222222",
        "fca_registration_number": "FCA789012",
        "contact_email": "info@commerciallending.com",
        "contact_phone": "+44 161 9876 5432",
        "website": "https://www.commerciallending.com",
        "company_story": "Specialist in commercial property finance and development funding.",
        "number_of_employees": 30,
        "financial_licences": "FCA Authorised",
        "membership_bodies": "UK Finance",
    }
)

UserRole.objects.get_or_create(user=lender2, role=lender_role)

# Create sample projects
print("\n3. Creating sample projects...")

projects_data = [
    {
        "borrower": borrower1_profile,
        "funding_type": "senior_debt",
        "property_type": "residential",
        "address": "45 Victoria Road",
        "town": "London",
        "county": "Greater London",
        "postcode": "SW1A 2BB",
        "description": "Conversion of Victorian townhouse into 4 luxury apartments. Full planning permission obtained.",
        "development_extent": "conversion",
        "tenure": "freehold",
        "planning_permission": True,
        "planning_authority": "Westminster City Council",
        "planning_reference": "PL/2024/001234",
        "loan_amount_required": Decimal("850000.00"),
        "term_required_months": 24,
        "repayment_method": "sale",
        "unit_counts": {"total_units": 4, "res_units": 4},
        "gross_internal_area": Decimal("450.00"),
        "purchase_price": Decimal("1200000.00"),
        "build_cost": Decimal("400000.00"),
        "current_market_value": Decimal("1200000.00"),
        "gross_development_value": Decimal("2400000.00"),
        "funds_provided_by_applicant": Decimal("350000.00"),
        "source_of_funds": "Personal savings and existing property equity",
        "status": "pending_review",
    },
    {
        "borrower": borrower1_profile,
        "funding_type": "mortgage",
        "property_type": "residential",
        "address": "12 High Street",
        "town": "Birmingham",
        "county": "West Midlands",
        "postcode": "B1 1AA",
        "description": "New build development of 6 townhouses. Planning permission in place.",
        "development_extent": "new_build",
        "tenure": "freehold",
        "planning_permission": True,
        "planning_authority": "Birmingham City Council",
        "planning_reference": "PL/2024/005678",
        "loan_amount_required": Decimal("1200000.00"),
        "term_required_months": 36,
        "repayment_method": "sale",
        "unit_counts": {"total_units": 6, "res_units": 6},
        "gross_internal_area": Decimal("1200.00"),
        "purchase_price": Decimal("500000.00"),
        "build_cost": Decimal("1500000.00"),
        "current_market_value": Decimal("500000.00"),
        "gross_development_value": Decimal("3000000.00"),
        "funds_provided_by_applicant": Decimal("800000.00"),
        "source_of_funds": "Investor funding",
        "status": "approved",
    },
    {
        "borrower": borrower2_profile,
        "funding_type": "senior_debt",
        "property_type": "commercial",
        "address": "78 Market Street",
        "town": "Manchester",
        "county": "Greater Manchester",
        "postcode": "M2 3AA",
        "description": "Heavy refurbishment of commercial office building. Converting to mixed-use with ground floor retail and upper floor offices.",
        "development_extent": "heavy_refurb",
        "tenure": "leasehold",
        "planning_permission": True,
        "planning_authority": "Manchester City Council",
        "planning_reference": "PL/2024/009876",
        "loan_amount_required": Decimal("650000.00"),
        "term_required_months": 18,
        "repayment_method": "refinance",
        "unit_counts": {"total_units": 8, "res_units": 0, "com_units": 8},
        "gross_internal_area": Decimal("800.00"),
        "purchase_price": Decimal("900000.00"),
        "build_cost": Decimal("350000.00"),
        "current_market_value": Decimal("900000.00"),
        "gross_development_value": Decimal("1800000.00"),
        "funds_provided_by_applicant": Decimal("600000.00"),
        "source_of_funds": "Company reserves",
        "status": "pending_review",
    },
    {
        "borrower": borrower2_profile,
        "funding_type": "equity",
        "property_type": "mixed",
        "address": "23 Industrial Way",
        "town": "Leeds",
        "county": "West Yorkshire",
        "postcode": "LS1 4BB",
        "description": "Light refurbishment of mixed-use property. Ground floor retail units and upper floor residential apartments.",
        "development_extent": "light_refurb",
        "tenure": "freehold",
        "planning_permission": False,
        "loan_amount_required": Decimal("300000.00"),
        "term_required_months": 12,
        "repayment_method": "sale",
        "unit_counts": {"total_units": 5, "res_units": 3, "com_units": 2},
        "gross_internal_area": Decimal("600.00"),
        "purchase_price": Decimal("750000.00"),
        "build_cost": Decimal("200000.00"),
        "current_market_value": Decimal("750000.00"),
        "gross_development_value": Decimal("1200000.00"),
        "funds_provided_by_applicant": Decimal("650000.00"),
        "source_of_funds": "Private investment",
        "status": "draft",
    },
]

for project_data in projects_data:
    project, created = Project.objects.get_or_create(
        borrower=project_data["borrower"],
        address=project_data["address"],
        postcode=project_data["postcode"],
        defaults=project_data
    )
    if created:
        print(f"   Created project: {project.address}, {project.town} ({project.status})")
    else:
        print(f"   Project already exists: {project.address}, {project.town}")

# Create sample products
print("\n4. Creating sample products...")

products_data = [
    {
        "lender": lender1_profile,
        "name": "Residential Development Finance",
        "description": "Fast-track development finance for residential projects. Competitive rates and flexible terms.",
        "funding_type": "senior_debt",
        "property_type": "residential",
        "min_loan_amount": Decimal("250000.00"),
        "max_loan_amount": Decimal("5000000.00"),
        "interest_rate_min": Decimal("6.50"),
        "interest_rate_max": Decimal("9.50"),
        "term_min_months": 12,
        "term_max_months": 36,
        "max_ltv_ratio": Decimal("75.00"),
        "repayment_structure": "interest_only",
        "fees": {
            "arrangement_fee": "2%",
            "admin_fee": "£2,500",
            "exit_fee": "1%"
        },
        "eligibility_criteria": "Minimum 2 years development experience. Planning permission required.",
        "status": "active",
    },
    {
        "lender": lender1_profile,
        "name": "Commercial Property Finance",
        "description": "Specialist finance for commercial property development and refurbishment projects.",
        "funding_type": "senior_debt",
        "property_type": "commercial",
        "min_loan_amount": Decimal("500000.00"),
        "max_loan_amount": Decimal("10000000.00"),
        "interest_rate_min": Decimal("7.00"),
        "interest_rate_max": Decimal("10.00"),
        "term_min_months": 18,
        "term_max_months": 48,
        "max_ltv_ratio": Decimal("70.00"),
        "repayment_structure": "interest_only",
        "fees": {
            "arrangement_fee": "2.5%",
            "admin_fee": "£5,000",
            "exit_fee": "1.5%"
        },
        "eligibility_criteria": "Established developers with proven track record. FCA regulated entities preferred.",
        "status": "active",
    },
    {
        "lender": lender2_profile,
        "name": "Mixed-Use Development Finance",
        "description": "Flexible finance solutions for mixed-use development projects combining residential and commercial elements.",
        "funding_type": "senior_debt",
        "property_type": "mixed",
        "min_loan_amount": Decimal("300000.00"),
        "max_loan_amount": Decimal("8000000.00"),
        "interest_rate_min": Decimal("6.75"),
        "interest_rate_max": Decimal("9.75"),
        "term_min_months": 12,
        "term_max_months": 42,
        "max_ltv_ratio": Decimal("72.50"),
        "repayment_structure": "interest_only",
        "fees": {
            "arrangement_fee": "2.25%",
            "admin_fee": "£3,500",
            "exit_fee": "1.25%"
        },
        "eligibility_criteria": "Suitable for experienced developers. Planning permission must be in place.",
        "status": "active",
    },
    {
        "lender": lender2_profile,
        "name": "Residential Mortgage Finance",
        "description": "Traditional mortgage finance for residential property purchases and developments.",
        "funding_type": "mortgage",
        "property_type": "residential",
        "min_loan_amount": Decimal("100000.00"),
        "max_loan_amount": Decimal("2000000.00"),
        "interest_rate_min": Decimal("4.50"),
        "interest_rate_max": Decimal("7.50"),
        "term_min_months": 12,
        "term_max_months": 60,
        "max_ltv_ratio": Decimal("80.00"),
        "repayment_structure": "amortising",
        "fees": {
            "arrangement_fee": "1%",
            "valuation_fee": "£500",
            "legal_fee": "£1,000"
        },
        "eligibility_criteria": "Standard residential mortgage criteria apply. Credit check required.",
        "status": "pending",
    },
]

for product_data in products_data:
    product, created = Product.objects.get_or_create(
        lender=product_data["lender"],
        name=product_data["name"],
        defaults=product_data
    )
    if created:
        print(f"   Created product: {product.name} ({product.status})")
    else:
        print(f"   Product already exists: {product.name}")

# Create sample applications
print("\n5. Creating sample applications...")

# Get approved projects and active products for matching
approved_projects = Project.objects.filter(status="approved")
active_products = Product.objects.filter(status="active")

if approved_projects.exists() and active_products.exists():
    project = approved_projects.first()
    # Find matching product
    matching_product = active_products.filter(
        funding_type=project.funding_type,
        property_type=project.property_type,
        min_loan_amount__lte=project.loan_amount_required,
        max_loan_amount__gte=project.loan_amount_required,
    ).first()
    
    if matching_product:
        application, created = Application.objects.get_or_create(
            project=project,
            lender=matching_product.lender,
            defaults={
                "product": matching_product,
                "proposed_loan_amount": project.loan_amount_required,
                "proposed_interest_rate": Decimal("7.50"),
                "proposed_term_months": project.term_required_months,
                "proposed_ltv_ratio": Decimal("70.00"),
                "notes": "Initial application based on project requirements. Awaiting further documentation.",
                "status": "pending",
            }
        )
        if created:
            print(f"   Created application: Project {project.id} → {matching_product.lender.organisation_name} ({application.status})")
        else:
            print(f"   Application already exists for this project")

# Create sample messages
print("\n6. Creating sample messages...")

if Application.objects.exists():
    application = Application.objects.first()
    message, created = Message.objects.get_or_create(
        application=application,
        sender=application.lender.user,
        recipient=application.project.borrower.user,
        subject="Application Received",
        defaults={
            "body": "Thank you for your interest. We have received your application and our team will review it shortly. We may require additional documentation.",
        }
    )
    if created:
        print(f"   Created message: {message.subject}")

print("\n" + "=" * 60)
print("Sample data population complete!")
print("=" * 60)
print("\nCreated:")
print(f"  - {User.objects.filter(borrowerprofile__isnull=False).count()} borrowers")
print(f"  - {User.objects.filter(lenderprofile__isnull=False).count()} lenders")
print(f"  - {Project.objects.count()} projects")
print(f"  - {Product.objects.count()} products")
print(f"  - {Application.objects.count()} applications")
print(f"  - {Message.objects.count()} messages")
print("\nTest credentials:")
print("  Borrower 1: borrower1 / password123")
print("  Borrower 2: borrower2 / password123")
print("  Lender 1: lender1 / password123")
print("  Lender 2: lender2 / password123")
print("\nYou can now test the system with this sample data!")
