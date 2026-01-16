#!/usr/bin/env python
"""Verify test users are set up correctly."""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'buildfund_app.settings')
django.setup()

from django.contrib.auth.models import User
from borrowers.models import BorrowerProfile
from lenders.models import LenderProfile
from accounts.models import Role, UserRole

borrower = User.objects.get(username='borrower1')
lender = User.objects.get(username='lender1')

print('Borrower Account:')
print(f'  Username: {borrower.username}')
print(f'  Email: {borrower.email}')
print(f'  Has BorrowerProfile: {hasattr(borrower, "borrowerprofile")}')
if hasattr(borrower, 'borrowerprofile'):
    print(f'  Profile: {borrower.borrowerprofile.first_name} {borrower.borrowerprofile.last_name}')
print(f'  Has Borrower role: {UserRole.objects.filter(user=borrower, role__name=Role.BORROWER).exists()}')

print('\nLender Account:')
print(f'  Username: {lender.username}')
print(f'  Email: {lender.email}')
print(f'  Has LenderProfile: {hasattr(lender, "lenderprofile")}')
if hasattr(lender, 'lenderprofile'):
    print(f'  Organisation: {lender.lenderprofile.organisation_name}')
print(f'  Has Lender role: {UserRole.objects.filter(user=lender, role__name=Role.LENDER).exists()}')
