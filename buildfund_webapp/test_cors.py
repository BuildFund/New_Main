#!/usr/bin/env python
"""Test CORS configuration by making a request to the API."""
import requests
import sys

try:
    # Test OPTIONS request (preflight)
    print("Testing CORS preflight (OPTIONS request)...")
    response = requests.options(
        'http://localhost:8000/api/',
        headers={'Origin': 'http://localhost:3000'}
    )
    print(f"Status: {response.status_code}")
    print(f"CORS Headers:")
    for header, value in response.headers.items():
        if 'access-control' in header.lower():
            print(f"  {header}: {value}")
    
    if 'Access-Control-Allow-Origin' in response.headers:
        allowed_origin = response.headers['Access-Control-Allow-Origin']
        if allowed_origin == 'http://localhost:3000' or allowed_origin == '*':
            print("\n[OK] CORS is configured correctly!")
        else:
            print(f"\n[WARNING] CORS allows: {allowed_origin}, but we need http://localhost:3000")
    else:
        print("\n[ERROR] No Access-Control-Allow-Origin header found!")
        print("CORS middleware may not be working correctly.")
        
except requests.exceptions.ConnectionError:
    print("[ERROR] Cannot connect to http://localhost:8000")
    print("Make sure the Django server is running!")
    sys.exit(1)
except Exception as e:
    print(f"[ERROR] {e}")
    sys.exit(1)
