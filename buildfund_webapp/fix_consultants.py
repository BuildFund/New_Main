"""Fix consultant users - create them properly with all required fields."""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'buildfund_app.settings')
django.setup()

from django.contrib.auth.models import User
from django.db import connection
from accounts.models import Role, UserRole
from consultants.models import ConsultantProfile
import json

def fix_consultant(username, email, password, org_name, primary_service, services_offered, qualifications):
    """Create or fix a consultant user."""
    # Create or get user
    user, _ = User.objects.get_or_create(
        username=username,
        defaults={'email': email, 'first_name': username.capitalize(), 'is_active': True}
    )
    user.email = email
    user.is_active = True
    user.set_password(password)
    user.save()
    
    # Assign Consultant role
    consultant_role, _ = Role.objects.get_or_create(name=Role.CONSULTANT)
    UserRole.objects.get_or_create(user=user, role=consultant_role)
    
    # Delete existing profile if any
    ConsultantProfile.objects.filter(user=user).delete()
    
    # Create profile - this will fail on wizard fields, so we'll update them after
    try:
        profile = ConsultantProfile.objects.create(
            user=user,
            organisation_name=org_name,
            primary_service=primary_service,
            services_offered=services_offered,
            qualifications=qualifications,
            contact_email=email,
            contact_phone='+44 20 1234 5678',
            address_line_1='123 Professional Street',
            city='London',
            county='Greater London',
            postcode='SW1A 1AA',
            country='United Kingdom',
            geographic_coverage=['Greater London'],
            years_of_experience=10,
            team_size=5,
            current_capacity=3,
            max_capacity=15,
            average_response_time_days=2,
            is_active=True,
            is_verified=True,
        )
    except Exception as e:
        print(f"Error creating profile for {username}: {e}")
        # Try to get it if it was partially created
        try:
            profile = ConsultantProfile.objects.get(user=user)
        except ConsultantProfile.DoesNotExist:
            raise
    
    # Update wizard fields using raw SQL (these fields exist in DB but not in model)
    with connection.cursor() as cursor:
        sql = "UPDATE consultants_consultantprofile SET completed_steps = %s, current_wizard_step = %s, wizard_data = %s, wizard_status = %s WHERE id = %s"
        cursor.execute(sql, [json.dumps([]), '', json.dumps({}), 'not_started', profile.id])
    
    print(f"[OK] Created/fixed {username}")
    return user

if __name__ == '__main__':
    print("Fixing consultant users...\n")
    
    fix_consultant('consultant1', 'consultant1@buildfund.co.uk', 'consultant123',
                   'Professional Monitoring Services Ltd', 'monitoring_surveyor',
                   ['monitoring_surveyor', 'valuation'], ['rics_monitoring', 'rics'])
    
    fix_consultant('solicitor1', 'solicitor1@buildfund.co.uk', 'solicitor123',
                   'Legal Conveyancing Partners', 'solicitor',
                   ['solicitor'], ['sra', 'cilex'])
    
    print("\n[SUCCESS] Users created!")
    print("consultant1 / consultant123")
    print("solicitor1 / solicitor123")
