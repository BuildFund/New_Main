#!/usr/bin/env python
"""Quick script to verify CORS configuration."""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'buildfund_app.settings')
django.setup()

from django.conf import settings

print("=" * 50)
print("CORS Configuration Verification")
print("=" * 50)
print(f"DEBUG: {settings.DEBUG}")
print(f"CORS_ALLOWED_ORIGINS: {settings.CORS_ALLOWED_ORIGINS}")
print(f"CORS_ALLOW_ALL_ORIGINS: {settings.CORS_ALLOW_ALL_ORIGINS}")
print(f"CORS_ALLOW_CREDENTIALS: {settings.CORS_ALLOW_CREDENTIALS}")
print(f"CORS Middleware in MIDDLEWARE: {'corsheaders.middleware.CorsMiddleware' in settings.MIDDLEWARE}")
if 'corsheaders.middleware.CorsMiddleware' in settings.MIDDLEWARE:
    pos = settings.MIDDLEWARE.index('corsheaders.middleware.CorsMiddleware')
    print(f"CORS Middleware position: {pos} (should be early, after SessionMiddleware)")
print("=" * 50)

# Check if localhost:3000 is allowed
if 'http://localhost:3000' in settings.CORS_ALLOWED_ORIGINS:
    print("[OK] http://localhost:3000 is in CORS_ALLOWED_ORIGINS")
else:
    print("[ERROR] http://localhost:3000 is NOT in CORS_ALLOWED_ORIGINS")
    print("  This will cause CORS errors from the frontend!")

print("=" * 50)
