#!/usr/bin/env python
"""Test script to verify OPENAI_API_KEY is loaded correctly."""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Mimic settings.py BASE_DIR calculation
BASE_DIR = Path(__file__).resolve().parent
print(f"BASE_DIR: {BASE_DIR}")

# Load .env file
env_path = BASE_DIR / '.env'
print(f"Looking for .env at: {env_path}")
print(f".env exists: {env_path.exists()}")

if env_path.exists():
    load_dotenv(env_path, override=True)
    print("OK: Loaded .env file")
else:
    print("ERROR: .env file not found")
    # Try fallback
    load_dotenv(override=True)

# Check if key is loaded
key = os.environ.get('OPENAI_API_KEY')
if key:
    print(f"OK: OPENAI_API_KEY is loaded")
    print(f"  Key length: {len(key)}")
    print(f"  Key starts with: {key[:15]}...")
    print(f"  Key is valid: {key.startswith('sk-') and len(key) > 20}")
else:
    print("ERROR: OPENAI_API_KEY is NOT loaded")
    print("  Available env vars with 'OPENAI':")
    for k, v in os.environ.items():
        if 'OPENAI' in k.upper():
            print(f"    {k} = {v[:20]}...")

# Test Django settings import
try:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'buildfund_app.settings')
    import django
    django.setup()
    from django.conf import settings
    settings_key = getattr(settings, 'OPENAI_API_KEY', None)
    if settings_key:
        print(f"\nOK: settings.OPENAI_API_KEY is set (length: {len(settings_key)})")
    else:
        print(f"\nERROR: settings.OPENAI_API_KEY is NOT set")
        print(f"  Type: {type(settings_key)}")
except Exception as e:
    print(f"\nERROR: Error importing Django settings: {e}")
