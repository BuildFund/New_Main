"""Final script to create consultant users using raw SQL."""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'buildfund_app.settings')
django.setup()

from django.contrib.auth.models import User
from django.db import connection
from accounts.models import Role, UserRole
import json

def create_consultant(username, email, password, org_name, primary_service, services_offered, qualifications):
    """Create consultant user and profile."""
    # Create/update user
    user, _ = User.objects.get_or_create(
        username=username,
        defaults={'email': email, 'first_name': username.capitalize(), 'is_active': True}
    )
    user.email = email
    user.is_active = True
    user.set_password(password)
    user.save()
    
    # Assign role
    consultant_role, _ = Role.objects.get_or_create(name=Role.CONSULTANT)
    UserRole.objects.get_or_create(user=user, role=consultant_role)
    
    # Delete existing profile
    from consultants.models import ConsultantProfile
    ConsultantProfile.objects.filter(user=user).delete()
    
    # Insert profile with all 49 fields (excluding id) using raw SQL
    # Use %s placeholders for Django's SQL formatting
    with connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO consultants_consultantprofile (
                organisation_name, trading_name, company_registration_number,
                services_offered, primary_service, qualifications,
                professional_registration_numbers, insurance_details, compliance_certifications,
                contact_email, contact_phone, website,
                address_line_1, address_line_2, city, county, postcode, country,
                geographic_coverage, service_description,
                years_of_experience, team_size, key_personnel,
                current_capacity, max_capacity, average_response_time_days,
                is_active, is_verified, verified_at,
                created_at, updated_at,
                user_id,
                account_holder_is_director, account_holder_name, account_holder_role,
                company_data, company_verified_at, consent_credit_search,
                consent_privacy, consent_terms, directors_data, mfa_enabled,
                mobile_number, shareholders_data, trading_address,
                completed_steps, current_wizard_step, wizard_data, wizard_status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, datetime('now'), datetime('now'), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, [
            org_name, '', '',  # organisation_name, trading_name, company_registration_number
            json.dumps(services_offered), primary_service, json.dumps(qualifications),  # services, primary, qualifications
            json.dumps({}), json.dumps({}), json.dumps([]),  # professional_reg, insurance, compliance
            email, '+44 20 1234 5678', '',  # contact_email, phone, website
            '123 Professional Street', '', 'London', 'Greater London', 'SW1A 1AA', 'United Kingdom',  # address fields
            json.dumps(['Greater London']), '',  # geographic_coverage, service_description
            10, 5, json.dumps([]),  # years_of_experience, team_size, key_personnel
            3, 15, 2,  # current_capacity, max_capacity, average_response_time_days
            1, 1, None,  # is_active, is_verified, verified_at
            user.id,  # user_id
            0, '', '',  # account_holder_is_director, name, role
            json.dumps({}), None, 0,  # company_data, company_verified_at, consent_credit_search
            0, 0, json.dumps([]), 0,  # consent_privacy, consent_terms, directors_data, mfa_enabled
            '', json.dumps([]), '',  # mobile_number, shareholders_data, trading_address
            json.dumps([]), '', json.dumps({}), 'not_started'  # wizard fields
        ])
    
    print(f"[OK] Created {username}")
    return user

if __name__ == '__main__':
    print("Creating consultant users...\n")
    
    create_consultant('consultant1', 'consultant1@buildfund.co.uk', 'consultant123',
                     'Professional Monitoring Services Ltd', 'monitoring_surveyor',
                     ['monitoring_surveyor', 'valuation'], ['rics_monitoring', 'rics'])
    
    create_consultant('solicitor1', 'solicitor1@buildfund.co.uk', 'solicitor123',
                     'Legal Conveyancing Partners', 'solicitor',
                     ['solicitor'], ['sra', 'cilex'])
    
    print("\n[SUCCESS] Users created!")
    print("consultant1 / consultant123")
    print("solicitor1 / solicitor123")
