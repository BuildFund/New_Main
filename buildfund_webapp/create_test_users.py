#!/usr/bin/env python
"""Create test borrower and lender accounts."""
import os
import django
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'buildfund_app.settings')
django.setup()

from django.contrib.auth.models import User
from accounts.models import Role, UserRole
from borrowers.models import BorrowerProfile
from lenders.models import LenderProfile

# Create Borrower
borrower_username = 'borrower1'
borrower_email = 'borrower1@buildfund.com'
borrower_password = 'borrower123'

user, created = User.objects.get_or_create(
    username=borrower_username,
    defaults={'email': borrower_email}
)
user.set_password(borrower_password)
user.save()

# Assign Borrower role
borrower_role, _ = Role.objects.get_or_create(name=Role.BORROWER)
UserRole.objects.get_or_create(user=user, role=borrower_role)

# Create BorrowerProfile
borrower_profile, created = BorrowerProfile.objects.get_or_create(
    user=user,
    defaults={
        'first_name': 'John',
        'last_name': 'Borrower',
        'company_name': 'Borrower Co Ltd',
        'phone_number': '+44 20 1234 5678',
        'city': 'London',
        'country': 'United Kingdom'
    }
)

if created:
    print(f"Created borrower account: {borrower_username} / {borrower_password}")
else:
    print(f"Borrower account already exists: {borrower_username} / {borrower_password}")

# Create Lender
lender_username = 'lender1'
lender_email = 'lender1@buildfund.com'
lender_password = 'lender123'

user2, created = User.objects.get_or_create(
    username=lender_username,
    defaults={'email': lender_email}
)
user2.set_password(lender_password)
user2.save()

# Assign Lender role
lender_role, _ = Role.objects.get_or_create(name=Role.LENDER)
UserRole.objects.get_or_create(user=user2, role=lender_role)

# Create LenderProfile
lender_profile, created = LenderProfile.objects.get_or_create(
    user=user2,
    defaults={
        'organisation_name': 'Lender Finance Ltd',
        'contact_email': lender_email,
        'contact_phone': '+44 20 9876 5432',
        'website': 'https://lenderfinance.example.com',
        'company_number': '12345678'
    }
)

if created:
    print(f"Created lender account: {lender_username} / {lender_password}")
else:
    print(f"Lender account already exists: {lender_username} / {lender_password}")

print("\n" + "="*50)
print("ACCOUNT CREDENTIALS:")
print("="*50)
print(f"\nBORROWER:")
print(f"  Username: {borrower_username}")
print(f"  Password: {borrower_password}")
print(f"\nLENDER:")
print(f"  Username: {lender_username}")
print(f"  Password: {lender_password}")
print("="*50)
