#!/usr/bin/env python
"""Test the token endpoint directly."""
import requests

url = 'http://127.0.0.1:8000/api/auth/token/'
data = {
    'username': 'admin',
    'password': 'Admin123!@#$'
}

# Try with form data (default for DRF)
print("Testing with form data:")
response = requests.post(url, data=data)
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

# Try with JSON
print("\nTesting with JSON:")
response = requests.post(url, json=data, headers={'Content-Type': 'application/json'})
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")
