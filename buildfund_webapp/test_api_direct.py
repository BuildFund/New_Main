#!/usr/bin/env python
"""Test the API endpoint directly with the same format as the frontend."""
import requests
from urllib.parse import quote

url = 'http://127.0.0.1:8000/api/auth/token/'

# Test with form data as string (like the frontend sends)
# URL encode the password since it has special characters
password = 'Admin123!@#$'
form_data = f'username=admin&password={quote(password)}'

headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'http://localhost:3000',
    'Referer': 'http://localhost:3000/'
}

print("Testing token endpoint with form data string:")
print(f"URL: {url}")
print(f"Headers: {headers}")
print(f"Body: {form_data}")

try:
    response = requests.post(url, data=form_data, headers=headers)
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    print(f"Response Body: {response.text}")
    
    if response.status_code == 200:
        print("\nSUCCESS! Token obtained.")
        data = response.json()
        print(f"Token: {data.get('token', 'N/A')[:20]}...")
    else:
        print(f"\nFAILED with status {response.status_code}")
        print(f"Response: {response.text}")
except Exception as e:
    print(f"\nERROR: {e}")
