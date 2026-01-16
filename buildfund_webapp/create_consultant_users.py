"""Script to create consultant test users."""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'buildfund_app.settings')
django.setup()

from django.contrib.auth.models import User
from accounts.models import Role, UserRole
from consultants.models import ConsultantProfile

def create_consultant_user(username, email, password, organisation_name, primary_service, services_offered, qualifications):
    """Create a consultant user with profile."""
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
    
    # Create or update consultant profile
    try:
        profile = ConsultantProfile.objects.get(user=user)
        created = False
        # Update existing profile
        profile.organisation_name = organisation_name
        profile.primary_service = primary_service
        profile.services_offered = services_offered
        profile.qualifications = qualifications
        profile.is_active = True
        profile.is_verified = True
        profile.save()
        print(f"[OK] Updated consultant profile for {username}")
    except ConsultantProfile.DoesNotExist:
        # Create new profile - use raw SQL to handle wizard fields that exist in DB but not model
        from django.db import connection
        import json
        
        profile = ConsultantProfile(
            user=user,
            organisation_name=organisation_name,
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
            geographic_coverage=['Greater London', 'South East', 'Nationwide'],
            years_of_experience=10,
            team_size=5,
            current_capacity=3,
            max_capacity=15,
            average_response_time_days=2,
            is_active=True,
            is_verified=True,
        )
        profile.save()
        
        # Update wizard fields using raw SQL
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE consultants_consultantprofile 
                SET completed_steps = ?, 
                    current_wizard_step = ?, 
                    wizard_data = ?, 
                    wizard_status = ?
                WHERE id = ?
            """, [
                json.dumps([]),
                '',
                json.dumps({}),
                'not_started',
                profile.id
            ])
        
        created = True
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
