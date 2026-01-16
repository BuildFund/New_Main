"""Script to create consultant test users - fixed version."""
import os
import django
import json

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'buildfund_app.settings')
django.setup()

from django.contrib.auth.models import User
from django.db import connection
from accounts.models import Role, UserRole
from consultants.models import ConsultantProfile

def create_consultant_user(username, email, password, organisation_name, primary_service, services_offered, qualifications):
    """Create a consultant user with profile using raw SQL to handle wizard fields."""
    # Create or get user
    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            'email': email,
            'first_name': username.capitalize(),
            'is_active': True,
        }
    )
    
    if not created:
        print(f"User {username} already exists. Updating...")
        user.email = email
        user.is_active = True
        user.save()
    
    # Set password
    user.set_password(password)
    user.save()
    
    # Get or create Consultant role
    consultant_role, _ = Role.objects.get_or_create(name=Role.CONSULTANT)
    
    # Assign role to user
    user_role, created = UserRole.objects.get_or_create(
        user=user,
        role=consultant_role
    )
    
    if created:
        print(f"[OK] Assigned Consultant role to {username}")
    
    # Check if profile exists
    try:
        profile = ConsultantProfile.objects.get(user=user)
        print(f"[OK] Profile already exists for {username}, updating...")
        profile.organisation_name = organisation_name
        profile.primary_service = primary_service
        profile.services_offered = services_offered
        profile.qualifications = qualifications
        profile.is_active = True
        profile.is_verified = True
        profile.save()
        return user, profile
    except ConsultantProfile.DoesNotExist:
        pass
    
    # Create profile using raw SQL to handle wizard fields
    with connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO consultants_consultantprofile (
                user_id, organisation_name, trading_name, company_registration_number,
                services_offered, primary_service, qualifications,
                professional_registration_numbers, insurance_details, compliance_certifications,
                contact_email, contact_phone, website,
                address_line_1, address_line_2, city, county, postcode, country,
                geographic_coverage, service_description,
                years_of_experience, team_size, key_personnel,
                current_capacity, max_capacity, average_response_time_days,
                is_active, is_verified, verified_at,
                created_at, updated_at,
                account_holder_is_director, account_holder_name, account_holder_role,
                company_data, company_verified_at, consent_credit_search,
                consent_privacy, consent_terms, directors_data, mfa_enabled,
                mobile_number, shareholders_data, trading_address,
                completed_steps, current_wizard_step, wizard_data, wizard_status
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        """, [
            user.id,
            organisation_name,
            '',  # trading_name
            '',  # company_registration_number
            json.dumps(services_offered),
            primary_service,
            json.dumps(qualifications),
            json.dumps({}),  # professional_registration_numbers
            json.dumps({}),  # insurance_details
            json.dumps([]),  # compliance_certifications
            email,
            '+44 20 1234 5678',
            '',  # website
            '123 Professional Street',
            '',  # address_line_2
            'London',
            'Greater London',
            'SW1A 1AA',
            'United Kingdom',
            json.dumps(['Greater London', 'South East', 'Nationwide']),
            '',  # service_description
            10,  # years_of_experience
            5,   # team_size
            json.dumps([]),  # key_personnel
            3,   # current_capacity
            15,  # max_capacity
            2,   # average_response_time_days
            1,   # is_active (True)
            1,   # is_verified (True)
            None,  # verified_at
            'datetime("now")',  # created_at
            'datetime("now")',  # updated_at
            0,   # account_holder_is_director (False)
            '',  # account_holder_name
            '',  # account_holder_role
            json.dumps({}),  # company_data
            None,  # company_verified_at
            0,   # consent_credit_search (False)
            0,   # consent_privacy (False)
            0,   # consent_terms (False)
            json.dumps([]),  # directors_data
            0,   # mfa_enabled (False)
            '',  # mobile_number
            json.dumps([]),  # shareholders_data
            '',  # trading_address
            json.dumps([]),  # completed_steps
            '',  # current_wizard_step
            json.dumps({}),  # wizard_data
            'not_started',  # wizard_status
        ])
        profile_id = cursor.lastrowid
    
    profile = ConsultantProfile.objects.get(id=profile_id)
    print(f"[OK] Created consultant profile for {username}")
    
    return user, profile

if __name__ == '__main__':
    print("Creating consultant test users...\n")
    
    # Create consultant1 - Monitoring Surveyor
    user1, profile1 = create_consultant_user(
        username='consultant1',
        email='consultant1@buildfund.co.uk',
        password='consultant123',
        organisation_name='Professional Monitoring Services Ltd',
        primary_service='monitoring_surveyor',
        services_offered=['monitoring_surveyor', 'valuation'],
        qualifications=['rics_monitoring', 'rics']
    )
    print(f"[OK] Created user: consultant1 (password: consultant123)\n")
    
    # Create solicitor1 - Solicitor
    user2, profile2 = create_consultant_user(
        username='solicitor1',
        email='solicitor1@buildfund.co.uk',
        password='solicitor123',
        organisation_name='Legal Conveyancing Partners',
        primary_service='solicitor',
        services_offered=['solicitor'],
        qualifications=['sra', 'cilex']
    )
    print(f"[OK] Created user: solicitor1 (password: solicitor123)\n")
    
    print("\n[SUCCESS] Consultant users created successfully!")
    print("\nLogin credentials:")
    print("  consultant1 / consultant123")
    print("  solicitor1 / solicitor123")
    print("\nBoth users have Consultant role and verified profiles.")
