"""
Test script to verify underwriter report generation data format and API response.
This script tests the data building and optionally tests the OpenAI API call.
"""
import os
import sys
import django
import json

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'buildfund_app.settings')
django.setup()

from applications.models import Application, UnderwriterReport
from applications.services import ReportInputBuilder
from applications.underwriter_service import UnderwriterReportService
from django.conf import settings


def test_data_building(application_id: int):
    """Test that we can build the input data correctly."""
    print(f"\n{'='*60}")
    print(f"Testing Data Building for Application ID: {application_id}")
    print(f"{'='*60}\n")
    
    try:
        # Get the application
        application = Application.objects.get(id=application_id)
        print(f"[OK] Found application: {application.id}")
        print(f"  - Project: {application.project}")
        print(f"  - Lender: {application.lender}")
        print(f"  - Product: {application.product}")
        
        # Check if product exists
        if not application.product:
            print("\n[ERROR] Application has no product assigned!")
            return False, None
        
        # Check product attributes
        print(f"\n[OK] Product details:")
        print(f"  - Name: {application.product.name}")
        print(f"  - term_min_months: {getattr(application.product, 'term_min_months', 'MISSING')}")
        print(f"  - term_max_months: {getattr(application.product, 'term_max_months', 'MISSING')}")
        print(f"  - interest_rate_min: {application.product.interest_rate_min}")
        print(f"  - interest_rate_max: {application.product.interest_rate_max}")
        print(f"  - max_ltv_ratio: {application.product.max_ltv_ratio}")
        
        # Build the input data
        print(f"\n{'='*60}")
        print("Building input data...")
        print(f"{'='*60}\n")
        
        builder = ReportInputBuilder(application)
        input_data = builder.build()
        
        print(f"[OK] Input data built successfully!")
        print(f"  - Keys: {list(input_data.keys())}")
        
        # Check lender_and_product_data specifically
        if 'lender_and_product_data' in input_data:
            product_data = input_data['lender_and_product_data'].get('product', {})
            print(f"\n[OK] Product data in input:")
            print(f"  - min_term_months: {product_data.get('min_term_months')}")
            print(f"  - max_term_months: {product_data.get('max_term_months')}")
            print(f"  - interest_rate_range: {product_data.get('interest_rate_range')}")
            print(f"  - ltv_range: {product_data.get('ltv_range')}")
        
        # Validate JSON serialization
        print(f"\n{'='*60}")
        print("Testing JSON serialization...")
        print(f"{'='*60}\n")
        
        json_str = json.dumps(input_data, indent=2, default=str)
        print(f"[OK] JSON serialization successful!")
        print(f"  - JSON size: {len(json_str)} characters")
        
        # Save to file for inspection
        output_file = f"test_report_input_{application_id}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(json_str)
        print(f"  - Saved to: {output_file}")
        
        return True, input_data
        
    except Application.DoesNotExist:
        print(f"\n[ERROR] Application {application_id} not found!")
        return False, None
    except Exception as e:
        print(f"\n[ERROR] building data: {e}")
        import traceback
        traceback.print_exc()
        return False, None


def test_openai_api(input_data: dict):
    """Test the OpenAI API call with the built data."""
    print(f"\n{'='*60}")
    print("Testing OpenAI API call...")
    print(f"{'='*60}\n")
    
    # Check API key
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        print("[ERROR] OPENAI_API_KEY is not configured!")
        return False
    
    print(f"[OK] OpenAI API key found (length: {len(api_key)})")
    
    try:
        from openai import OpenAI
        from applications.underwriter_service import UnderwriterReportService
        
        service = UnderwriterReportService()
        print(f"[OK] Service initialized")
        print(f"  - Model: {service.model}")
        
        # Build the prompt
        user_prompt = service.USER_PROMPT_TEMPLATE.format(
            REPORT_INPUT_JSON=json.dumps(input_data, indent=2)
        )
        
        print(f"\n[OK] Prompt built")
        print(f"  - Prompt length: {len(user_prompt)} characters")
        
        # Make API call
        print(f"\n{'='*60}")
        print("Calling OpenAI API...")
        print(f"{'='*60}\n")
        print("This may take 30-60 seconds...\n")
        
        response = service.client.chat.completions.create(
            model=service.model,
            messages=[
                {"role": "system", "content": service.SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        
        print(f"[OK] API call successful!")
        print(f"  - Model used: {response.model}")
        print(f"  - Tokens used: {response.usage.total_tokens if hasattr(response, 'usage') else 'N/A'}")
        
        # Parse response
        content = response.choices[0].message.content
        print(f"  - Response length: {len(content)} characters")
        
        # Try to parse as JSON
        try:
            report_json = json.loads(content)
            print(f"[OK] Response is valid JSON")
            print(f"  - Top-level keys: {list(report_json.keys())[:10]}")
            
            # Validate schema
            if service._validate_schema(report_json):
                print(f"[OK] Schema validation passed!")
            else:
                print(f"[WARNING] Schema validation failed - missing required keys")
            
            # Save response
            output_file = "test_openai_response.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(report_json, f, indent=2)
            print(f"  - Saved to: {output_file}")
            
            return True
            
        except json.JSONDecodeError as e:
            print(f"[ERROR] Response is not valid JSON: {e}")
            print(f"  - First 500 chars: {content[:500]}")
            return False
        
    except Exception as e:
        print(f"[ERROR] calling OpenAI API: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main test function."""
    print("\n" + "="*60)
    print("UNDERWRITER REPORT GENERATION TEST")
    print("="*60)
    
    # Get application ID from command line or use first available
    if len(sys.argv) > 1:
        application_id = int(sys.argv[1])
    else:
        # Find first application with a product
        applications = Application.objects.filter(product__isnull=False)[:1]
        if not applications.exists():
            print("\n[ERROR] No applications found with products!")
            print("   Please create an application first or provide an ID:")
            print("   python test_underwriter_report.py <application_id>")
            return
        application_id = applications.first().id
        print(f"\nUsing first available application: {application_id}")
    
    # Test 1: Data building
    success, input_data = test_data_building(application_id)
    if not success:
        print("\n[ERROR] Data building failed. Cannot proceed with API test.")
        return
    
    # Test 2: OpenAI API (optional - pass --test-api flag to test)
    test_api = '--test-api' in sys.argv or '-t' in sys.argv
    if test_api:
        print(f"\n{'='*60}")
        print("API TEST")
        print(f"{'='*60}")
        test_openai_api(input_data)
    else:
        print(f"\n{'='*60}")
        print("API TEST SKIPPED")
        print(f"{'='*60}")
        print("\nTo test the OpenAI API, run with --test-api flag:")
        print("  python test_underwriter_report.py <application_id> --test-api")
    
    print(f"\n{'='*60}")
    print("TEST COMPLETE")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
