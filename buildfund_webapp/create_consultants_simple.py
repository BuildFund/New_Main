"""Simple script to create consultant users - uses Django ORM with minimal fields."""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'buildfund_app.settings')
django.setup()

from django.contrib.auth.models import User
from django.db import connection
from accounts.models import Role, UserRole

def create_consultant_user(username, email, password, organisation_name, primary_service, services_offered, qualifications):
    """Create a consultant user."""
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
    
    # Create profile using raw SQL with all required fields
    import json
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
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        """, [
            user.id, organisation_name, '', '', json.dumps(services_offered), primary_service, json.dumps(qualifications),
            json.dumps({}), json.dumps({}), json.dumps([]),
            email, '+44 20 1234 5678', '',
            '123 Professional Street', '', 'London', 'Greater London', 'SW1A 1AA', 'United Kingdom',
            json.dumps(['Greater London', 'South East', 'Nationwide']), '',
            10, 5, json.dumps([]),
            3, 15, 2,
            1, 1, None,
            0, '', '',
            json.dumps({}), None, 0,
            0, 0, json.dumps([]), 0,
            '', json.dumps([]), '',
            json.dumps([]), '', json.dumps({}), 'not_started'
        ])
    
    print(f"[OK] Created consultant profile for {username}")
    return user

if __name__ == '__main__':
    print("Creating consultant test users...\n")
    
    user1 = create_consultant_user(
        'consultant1', 'consultant1@buildfund.co.uk', 'consultant123',
        'Professional Monitoring Services Ltd', 'monitoring_surveyor',
        ['monitoring_surveyor', 'valuation'], ['rics_monitoring', 'rics']
    )
    print(f"[OK] Created user: consultant1 (password: consultant123)\n")
    
    user2 = create_consultant_user(
        'solicitor1', 'solicitor1@buildfund.co.uk', 'solicitor123',
        'Legal Conveyancing Partners', 'solicitor',
        ['solicitor'], ['sra', 'cilex']
    )
    print(f"[OK] Created user: solicitor1 (password: solicitor123)\n")
    
    print("\n[SUCCESS] Consultant users created!")
    print("Login: consultant1 / consultant123")
    print("Login: solicitor1 / solicitor123")
