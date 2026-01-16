#!/usr/bin/env python
"""Test authentication for admin user."""
import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "buildfund_app.settings")
django.setup()

from django.contrib.auth.models import User
from django.contrib.auth import authenticate

username = 'admin'
password = 'Admin123!@#$'

try:
    user = User.objects.get(username=username)
    print(f"User exists: {user.username}")
    print(f"Email: {user.email}")
    print(f"Is active: {user.is_active}")
    print(f"Is staff: {user.is_staff}")
    print(f"Is superuser: {user.is_superuser}")
    
    # Test password
    if user.check_password(password):
        print("Password check: PASSED")
    else:
        print("Password check: FAILED")
    
    # Test authentication
    auth_user = authenticate(username=username, password=password)
    if auth_user:
        print("Authentication: SUCCESS")
    else:
        print("Authentication: FAILED")
        
except User.DoesNotExist:
    print(f"User '{username}' does not exist!")
