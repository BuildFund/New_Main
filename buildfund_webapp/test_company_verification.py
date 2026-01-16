"""
Test script to verify company verification API is working.
Run this after restarting the Django server.
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'buildfund_app.settings')
django.setup()

from django.conf import settings
from verification.services import HMRCVerificationService

def test_api_key():
    """Test that API key is loaded."""
    print("=" * 60)
    print("Testing HMRC API Key Configuration")
    print("=" * 60)
    
    # Check settings
    if hasattr(settings, 'HMRC_API_KEY') and settings.HMRC_API_KEY:
        print(f"✓ HMRC_API_KEY is set in Django settings")
        print(f"  Key (first 15 chars): {settings.HMRC_API_KEY[:15]}...")
    else:
        print("✗ HMRC_API_KEY is NOT set in Django settings")
        print("  Make sure the .env file is loaded and server is restarted")
        return False
    
    # Test service initialization
    try:
        service = HMRCVerificationService()
        print("✓ HMRCVerificationService initialized successfully")
    except ValueError as e:
        print(f"✗ Failed to initialize service: {e}")
        return False
    
    # Test API call with a known company (Companies House test company)
    print("\n" + "=" * 60)
    print("Testing API Call (Company: 00000006 - A & C BLACK LIMITED)")
    print("=" * 60)
    
    try:
        result = service.get_company_info('00000006')
        if 'error' in result:
            print(f"✗ API call failed: {result.get('error')}")
            if 'status_code' in result:
                print(f"  Status code: {result.get('status_code')}")
            return False
        else:
            print(f"✓ API call successful!")
            print(f"  Company name: {result.get('company_name', 'N/A')}")
            print(f"  Company status: {result.get('company_status', 'N/A')}")
            print(f"  Company type: {result.get('company_type', 'N/A')}")
            return True
    except Exception as e:
        print(f"✗ API call exception: {e}")
        return False

if __name__ == '__main__':
    success = test_api_key()
    print("\n" + "=" * 60)
    if success:
        print("✓ All tests passed! Company verification is working.")
    else:
        print("✗ Tests failed. Please check the configuration.")
    print("=" * 60)
    sys.exit(0 if success else 1)
