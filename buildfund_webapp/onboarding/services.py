"""Services for onboarding data collection and verification."""
from __future__ import annotations

import os
import requests
from typing import Dict, Any, Optional
from django.conf import settings
from verification.services import HMRCVerificationService


class AddressVerificationService:
    """Service for verifying addresses using Google Maps API."""
    
    def __init__(self):
        """Initialize the service with API key from environment."""
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError(
                "GOOGLE_API_KEY environment variable is required. "
                "Set it in your .env file or environment variables."
            )
        self.api_key = api_key
    
    def verify_address(self, address_line_1: str, postcode: str, town: str = "", country: str = "United Kingdom") -> Dict[str, Any]:
        """
        Verify address using Google Maps Geocoding API.
        
        Args:
            address_line_1: First line of address
            postcode: UK postcode
            town: Town/city
            country: Country (default: United Kingdom)
            
        Returns:
            Dictionary with verification results:
            {
                "verified": bool,
                "formatted_address": str,
                "components": dict,
                "confidence_score": float,
                "message": str
            }
        """
        # Build address string
        address_parts = [address_line_1]
        if town:
            address_parts.append(town)
        address_parts.append(postcode)
        if country:
            address_parts.append(country)
        
        address_string = ", ".join(address_parts)
        
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            "address": address_string,
            "key": self.api_key,
            "region": "gb",  # UK region
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") == "OK" and data.get("results"):
                result = data["results"][0]
                formatted_address = result.get("formatted_address", "")
                components = {}
                
                # Extract address components
                for component in result.get("address_components", []):
                    types = component.get("types", [])
                    if "postal_code" in types:
                        components["postcode"] = component.get("long_name")
                    elif "locality" in types or "postal_town" in types:
                        components["town"] = component.get("long_name")
                    elif "administrative_area_level_2" in types:
                        components["county"] = component.get("long_name")
                    elif "country" in types:
                        components["country"] = component.get("long_name")
                    elif "street_number" in types:
                        components["street_number"] = component.get("long_name")
                    elif "route" in types:
                        components["route"] = component.get("long_name")
                
                # Calculate confidence score based on match quality
                confidence_score = 0.8  # Base score
                if components.get("postcode") and postcode.upper().replace(" ", "") in components.get("postcode", "").replace(" ", ""):
                    confidence_score += 0.1
                if components.get("town") and town.lower() in components.get("town", "").lower():
                    confidence_score += 0.1
                confidence_score = min(confidence_score, 1.0)
                
                return {
                    "verified": True,
                    "formatted_address": formatted_address,
                    "components": components,
                    "confidence_score": confidence_score,
                    "message": "Address verified successfully",
                    "geometry": result.get("geometry", {}),
                }
            else:
                return {
                    "verified": False,
                    "formatted_address": None,
                    "components": {},
                    "confidence_score": 0.0,
                    "message": f"Address verification failed: {data.get('status', 'Unknown error')}",
                }
        except requests.RequestException as e:
            return {
                "verified": False,
                "formatted_address": None,
                "components": {},
                "confidence_score": 0.0,
                "message": f"Failed to verify address: {str(e)}",
            }


class OnboardingChatbotService:
    """Service for managing onboarding chatbot conversations."""
    
    # Define onboarding steps based on user role - FCA Compliant
    # Order: Personal Info → Contact → Address → Company → Directors → KYC/Financial → Documents
    BORROWER_STEPS = [
        "welcome",
        # Personal Information (FCA Requirement)
        "profile_name",
        "profile_last_name",
        "profile_dob",
        "contact_email",
        "contact_phone",
        # Address Information (FCA Requirement)
        "address_collection",
        "address_verification",
        "address_confirmation",
        # Company Information (FCA Requirement)
        "company_collection",
        "company_verification",
        "company_confirmation",
        # Directors Information (FCA Requirement - HMRC Validation)
        "directors_list",
        "director_details",  # Loop for each director
        # KYC and Financial Information (FCA Requirement for Borrowers)
        "kyc_nationality",
        "kyc_national_insurance",
        "kyc_source_of_funds",
        "financial_income",
        "financial_employment",
        "financial_employment_details",
        "financial_expenses",
        "financial_existing_debts",
        "financial_assets",
        "experience_collection",
        # Documents (FCA Requirement)
        "documents_collection",
        "review",
        "complete",
    ]
    
    LENDER_STEPS = [
        "welcome",
        # Personal Information (FCA Requirement)
        "profile_name",
        "profile_last_name",
        "profile_dob",
        "contact_email",
        "contact_phone",
        # Address Information (FCA Requirement)
        "address_collection",
        "address_verification",
        "address_confirmation",
        # Company Information (FCA Requirement)
        "company_collection",
        "company_verification",
        "company_confirmation",
        # Directors Information (FCA Requirement - HMRC Validation)
        "directors_list",
        "director_details",  # Loop for each director
        # FCA Registration and Financial Information (FCA Requirement for Lenders)
        "fca_registration",
        "fca_registration_number",
        "fca_permissions",
        "financial_licences",
        "financial_capital_requirements",
        "financial_lending_capacity",
        "key_personnel",
        "kyc_source_of_funds",
        # Documents (FCA Requirement)
        "documents_collection",
        "review",
        "complete",
    ]
    
    ADMIN_STEPS = [
        "welcome",
        "profile_name",
        "contact_phone",
        "complete",
    ]
    
    CONSULTANT_STEPS = [
        "welcome",
        # Personal Information (FCA Requirement)
        "profile_name",
        "profile_last_name",
        "profile_dob",
        "contact_email",
        "contact_phone",
        # Address Information (FCA Requirement)
        "address_collection",
        "address_verification",
        "address_confirmation",
        # Company Information (FCA Requirement)
        "company_collection",
        "company_verification",
        "company_confirmation",
        # Professional Information
        "consultant_services",
        "consultant_qualifications",
        "consultant_registration",
        "consultant_insurance",
        "consultant_coverage",
        # Documents (FCA Requirement)
        "documents_collection",
        "review",
        "complete",
    ]
    
    def get_steps_for_role(self, role: str) -> list:
        """Get onboarding steps based on user role."""
        if role == "Borrower":
            return self.BORROWER_STEPS
        elif role == "Lender":
            return self.LENDER_STEPS
        elif role == "Admin":
            return self.ADMIN_STEPS
        elif role == "Consultant":
            return self.CONSULTANT_STEPS
        return []
    
    def get_required_documents(self, user_role: str) -> list:
        """Get list of required documents for the user role."""
        if user_role == "Borrower":
            return [
                {
                    "name": "Proof of Identity",
                    "description": "Passport or UK driving licence (front and back)",
                    "required_for": "FCA KYC compliance - Identity verification",
                    "category": "identity"
                },
                {
                    "name": "Proof of Address",
                    "description": "Utility bill or bank statement (dated within last 3 months)",
                    "required_for": "FCA KYC compliance - Address verification",
                    "category": "address"
                },
                {
                    "name": "Bank Statements",
                    "description": "Last 3 months of business/personal bank statements",
                    "required_for": "Financial assessment and affordability check",
                    "category": "financial"
                },
                {
                    "name": "Company Accounts",
                    "description": "Latest company accounts (last 2-3 years if available)",
                    "required_for": "Company financial assessment (if applicable)",
                    "category": "company",
                    "required_if": "company_registration_number"
                },
                {
                    "name": "Certificate of Incorporation",
                    "description": "Company certificate of incorporation",
                    "required_for": "Company verification (if applicable)",
                    "category": "company",
                    "required_if": "company_registration_number"
                },
            ]
        return []
    
    def check_uploaded_documents(self, collected_data: Dict[str, Any], user_role: str) -> Dict[str, Any]:
        """Check which required documents have been uploaded."""
        required_docs = self.get_required_documents(user_role)
        uploaded_docs = collected_data.get("documents_uploaded", [])
        uploaded_doc_names = [doc.get("file_name", "").lower() for doc in uploaded_docs if isinstance(doc, dict)]
        
        # Also check if we have document IDs (from onboarding_data)
        uploaded_doc_ids = [doc.get("id") for doc in uploaded_docs if isinstance(doc, dict) and doc.get("id")]
        
        missing_docs = []
        uploaded_required = []
        
        for req_doc in required_docs:
            # Check if document is required (based on conditions)
            is_required = True
            if "required_if" in req_doc:
                # Only required if certain data exists
                if not collected_data.get(req_doc["required_if"]):
                    is_required = False
            
            if is_required:
                # Check if any uploaded document matches this requirement
                doc_found = False
                
                # Check by file name keywords
                for uploaded_name in uploaded_doc_names:
                    # Check if uploaded file name contains keywords from required doc
                    keywords = req_doc["name"].lower().split()
                    category_keywords = req_doc.get("category", "").lower().split()
                    
                    # Check for matches
                    name_match = any(keyword in uploaded_name for keyword in keywords if len(keyword) > 3)
                    category_match = any(cat in uploaded_name for cat in category_keywords if len(cat) > 3)
                    
                    if name_match or category_match:
                        doc_found = True
                        break
                
                # If we have uploaded documents (by count), assume they might match
                # This is a fallback - in production, you'd want better matching
                if not doc_found and len(uploaded_docs) > 0:
                    # For now, if documents are uploaded, we'll be lenient
                    # In production, implement proper document type matching
                    pass
                
                if doc_found or (len(uploaded_docs) >= len([d for d in required_docs if not d.get("required_if") or collected_data.get(d.get("required_if"))])):
                    uploaded_required.append(req_doc)
                else:
                    missing_docs.append(req_doc)
        
        return {
            "required_documents": required_docs,
            "uploaded_documents": uploaded_required,
            "missing_documents": missing_docs,
            "all_uploaded": len(missing_docs) == 0,
            "uploaded_count": len(uploaded_docs),
            "required_count": len([d for d in required_docs if not d.get("required_if") or collected_data.get(d.get("required_if"))]),
        }
    
    def get_next_question(self, step: str, user_role: str, collected_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get the next question for the chatbot based on current step.
        
        Returns:
            {
                "question": str,
                "step": str,
                "field": str,
                "type": str,  # text, date, number, email, phone, file, select
                "options": list,  # for select type
                "required": bool,
                "validation": dict,
            }
        """
        questions = {
            "welcome": {
                "question": f"""Hi! 👋 Welcome to BuildFund. I'm here to help you complete your FCA-compliant funding application.

To build a complete application for {'development' if user_role == 'Borrower' else 'lending'} finance, I'll need to collect the following information:

📋 **Required Information:**
1. **Personal Information** - Name, date of birth, contact details
2. **Address & Contact** - Full address, email, phone number
3. **Company Information** - Company registration, details (validated with Companies House)
4. **Directors Information** - Details for all company directors (HMRC validated)
5. **Financial Information** - Income, expenses, assets, liabilities
6. **Asset & Liability Statement** - Complete financial position
7. **Experience & Portfolio** - Past experience and current assets/portfolio
8. **Supporting Documents** - ID, bank statements, company accounts, etc.

This process typically takes 15-20 minutes. You can save your progress at any time.

**Ready to begin?**""",
                "step": "welcome",
                "field": "welcome_acknowledged",
                "type": "select",
                "options": ["Yes, let's start", "I need more information", "Maybe later"],
                "required": True,
            },
            # Personal Information (FCA Requirement)
            "profile_name": {
                "question": "Great! Let's start with your personal information. What's your first name?",
                "step": "profile_name",
                "field": "first_name",
                "type": "text",
                "required": True,
            },
            "profile_last_name": {
                "question": "Thank you! What's your last name?",
                "step": "profile_last_name",
                "field": "last_name",
                "type": "text",
                "required": True,
            },
            "profile_dob": {
                "question": "Perfect! Now, what's your date of birth? (Please enter in format: DD/MM/YYYY)",
                "step": "profile_dob",
                "field": "date_of_birth",
                "type": "date",
                "required": True,
                "validation": {"format": "DD/MM/YYYY"},
            },
            "contact_email": {
                "question": "What's your contact email address? (This will be used for important communications)",
                "step": "contact_email",
                "field": "email",
                "type": "email",
                "required": True,
            },
            "contact_phone": {
                "question": "What's your phone number? (Please include country code, e.g., +44 for UK)",
                "step": "contact_phone",
                "field": "phone_number",
                "type": "phone",
                "required": True,
            },
            "address_collection": {
                "question": "Now let's get your address. What's your postcode?",
                "step": "address_collection",
                "field": "postcode",
                "type": "text",
                "required": True,
            },
            "address_verification": {
                "question": "I found your address. Is this correct? {formatted_address}",
                "step": "address_verification",
                "field": "address_confirmed",
                "type": "select",
                "options": ["Yes, that's correct", "No, let me enter it manually"],
                "required": True,
            },
            "address_confirmation": {
                "question": "{address_manual_prompt}",
                "step": "address_confirmation",
                "field": "address_line_1",
                "type": "text",
                "required": True,
            },
            # Company Information (FCA Requirement - Companies House Validation)
            "company_collection": {
                "question": "Do you have a UK company registration number? (If yes, please provide it. If no, type 'skip')",
                "step": "company_collection",
                "field": "company_registration_number",
                "type": "text",
                "required": False,
            },
            "company_verification": {
                "question": "I've verified your company with Companies House. Is {company_name} correct?",
                "step": "company_verification",
                "field": "company_confirmed",
                "type": "select",
                "options": ["Yes, that's correct", "No, that's wrong"],
                "required": True,
            },
            "company_confirmation": {
                "question": "Please confirm your company name as registered with Companies House:",
                "step": "company_confirmation",
                "field": "company_name",
                "type": "text",
                "required": True,
            },
            # Directors Information (FCA Requirement - HMRC Validation)
            "directors_list": {
                "question": "I've retrieved the list of directors from Companies House. We need to collect details for each director. {directors_list}",
                "step": "directors_list",
                "field": "directors_acknowledged",
                "type": "select",
                "options": ["Yes, I'm ready to provide director details", "I need to check the list"],
                "required": True,
            },
            "director_details": {
                "question": "Please provide details for director {director_index}: Full name, Date of Birth (DD/MM/YYYY), and Nationality. Format: Name, DOB, Nationality",
                "step": "director_details",
                "field": "director_details",
                "type": "text",
                "required": True,
            },
            # KYC Information (FCA Requirement for Borrowers)
            "kyc_nationality": {
                "question": "What's your nationality?",
                "step": "kyc_nationality",
                "field": "nationality",
                "type": "text",
                "required": True,
            },
            "kyc_national_insurance": {
                "question": "What's your UK National Insurance Number? (If you don't have one, type 'skip')",
                "step": "kyc_national_insurance",
                "field": "national_insurance_number",
                "type": "text",
                "required": False,
            },
            "kyc_source_of_funds": {
                "question": "What is the source of funds for your loan application? (e.g., savings, sale of property, inheritance, etc.)",
                "step": "kyc_source_of_funds",
                "field": "source_of_funds",
                "type": "text",
                "required": True,
            },
            # Financial Information (FCA Requirement for Borrowers)
            "financial_income": {
                "question": "What's your annual income? (Please enter the amount in GBP, e.g., 50000)",
                "step": "financial_income",
                "field": "annual_income",
                "type": "number",
                "required": True,
            },
            "financial_employment": {
                "question": "What's your employment status?",
                "step": "financial_employment",
                "field": "employment_status",
                "type": "select",
                "options": ["Employed", "Self-employed", "Retired", "Student", "Unemployed", "Other"],
                "required": True,
            },
            "financial_employment_details": {
                "question": "Please provide your employment details: Company name and position (or type 'skip' if not applicable)",
                "step": "financial_employment_details",
                "field": "employment_details",
                "type": "text",
                "required": False,
            },
            "financial_expenses": {
                "question": "What are your approximate monthly expenses? (Please enter the amount in GBP)",
                "step": "financial_expenses",
                "field": "monthly_expenses",
                "type": "number",
                "required": False,
            },
            "financial_existing_debts": {
                "question": "Do you have any existing debts? If yes, please enter the total amount in GBP (or 0 if none)",
                "step": "financial_existing_debts",
                "field": "existing_debts",
                "type": "number",
                "required": False,
            },
            "financial_assets": {
                "question": "What is the approximate value of your assets? (Please enter the amount in GBP, e.g., property, savings, investments)",
                "step": "financial_assets",
                "field": "total_assets",
                "type": "number",
                "required": False,
            },
            "experience_collection": {
                "question": "How many years of experience do you have in property development or business finance?",
                "step": "experience_collection",
                "field": "experience_years",
                "type": "number",
                "required": True,
            },
            "experience_projects": {
                "question": "How many projects have you completed? (Enter number, or 0 if this is your first)",
                "step": "experience_projects",
                "field": "previous_projects",
                "type": "number",
                "required": True,
            },
            "portfolio_current_assets": {
                "question": "Do you have a current property portfolio or business assets? If yes, please describe (e.g., '3 residential properties, 1 commercial property', or 'none')",
                "step": "portfolio_current_assets",
                "field": "portfolio_description",
                "type": "text",
                "required": False,
            },
            "portfolio_property_details": {
                "question": "Please provide details about your current property portfolio: Property addresses, values, and any mortgages (or type 'none' if not applicable)",
                "step": "portfolio_property_details",
                "field": "portfolio_property_details",
                "type": "text",
                "required": False,
            },
            # Funding Type Selection (NEW)
            "funding_type_selection": {
                "question": self._get_funding_type_question(collected_data),
                "step": "funding_type_selection",
                "field": "funding_type",
                "type": "select",
                "options": self._get_funding_type_options(),
                "required": True,
            },
            # FCA Registration and Financial Information (FCA Requirement for Lenders)
            "fca_registration": {
                "question": "Are you registered with the Financial Conduct Authority (FCA)?",
                "step": "fca_registration",
                "field": "has_fca_registration",
                "type": "select",
                "options": ["Yes", "No"],
                "required": True,
            },
            "fca_registration_number": {
                "question": "What's your FCA registration number?",
                "step": "fca_registration_number",
                "field": "fca_registration_number",
                "type": "text",
                "required": False,
            },
            "fca_permissions": {
                "question": "What FCA permissions does your organisation hold? (Please list them, e.g., Consumer Credit, Mortgage Lending, etc.)",
                "step": "fca_permissions",
                "field": "fca_permissions",
                "type": "text",
                "required": False,
            },
            "financial_licences": {
                "question": "What other financial licences does your organisation hold? (Please list them, or type 'none')",
                "step": "financial_licences",
                "field": "financial_licences",
                "type": "text",
                "required": False,
            },
            "financial_capital_requirements": {
                "question": "What is your organisation's regulatory capital requirement? (Please enter the amount in GBP)",
                "step": "financial_capital_requirements",
                "field": "regulatory_capital",
                "type": "number",
                "required": False,
            },
            "financial_lending_capacity": {
                "question": "What is your organisation's total lending capacity? (Please enter the amount in GBP)",
                "step": "financial_lending_capacity",
                "field": "lending_capacity",
                "type": "number",
                "required": False,
            },
            "key_personnel": {
                "question": "Who are the key personnel in your organisation? (Please provide names and positions, or type 'skip')",
                "step": "key_personnel",
                "field": "key_personnel",
                "type": "text",
                "required": False,
            },
            "documents_collection": {
                "question": self._get_documents_question(user_role, collected_data),
                "step": "documents_collection",
                "field": "documents",
                "type": "file",
                "required": True,
                "multiple": True,
            },
            "review": {
                "question": """Great! We've collected all the information needed for your FCA-compliant funding application. Let me summarize what we have:

{summary}

**Next Steps:**
- Review the information above
- If everything is correct, we'll proceed to document upload
- If you need to make changes, we can go back and update any section

Does everything look correct?""",
                "step": "review",
                "field": "review_confirmed",
                "type": "select",
                "options": ["Yes, everything is correct", "No, I need to make changes"],
                "required": True,
            },
            "complete": {
                "question": "Perfect! 🎉 Your profile is now complete. You can now submit applications and access all features. Is there anything else you'd like to update?",
                "step": "complete",
                "field": "complete",
                "type": "select",
                "options": ["No, I'm done", "Yes, I want to update something"],
                "required": False,
            },
        }
        
        question_template = questions.get(step, {})
        if not question_template:
            return None
        
        # Customize question based on collected data
        question = question_template.get("question", "")
        
        # Replace placeholders in question
        if "{formatted_address}" in question and "address_verification_data" in collected_data:
            addr_data = collected_data.get("address_verification_data", {})
            formatted_addr = addr_data.get("formatted_address") or "the address"
            question = question.replace("{formatted_address}", str(formatted_addr))
        
        # Handle address manual entry prompt
        if "{address_manual_prompt}" in question:
            address_fields_collected = collected_data.get("address_fields_collected", [])
            address_lookup_failed = collected_data.get("address_lookup_failed", False)
            
            if address_lookup_failed:
                # API failed - explain and start manual collection
                if "address_line_1" not in address_fields_collected:
                    question = "I couldn't find your address automatically. Let's enter it manually. Please provide your Address Line 1 (street name and number):"
                elif "address_line_2" not in address_fields_collected:
                    question = "Address Line 2 (optional - apartment, suite, etc. or type 'skip'):"
                elif "town" not in address_fields_collected:
                    question = "What's your town or city?"
                elif "county" not in address_fields_collected:
                    question = "What's your county?"
                elif "postcode" not in address_fields_collected or not collected_data.get("postcode"):
                    postcode = collected_data.get("postcode", "")
                    if postcode:
                        question = f"Confirm your postcode (currently: {postcode}) or enter a new one:"
                    else:
                        question = "What's your postcode?"
                elif "country" not in address_fields_collected:
                    question = "What's your country? (default: United Kingdom, or type 'skip' to use default):"
                else:
                    question = "Address collection complete. Moving to next step..."
            else:
                # Normal confirmation flow (user chose manual entry)
                if "address_line_1" not in address_fields_collected:
                    question = "Please provide your Address Line 1 (street name and number):"
                elif "address_line_2" not in address_fields_collected:
                    question = "Address Line 2 (optional - apartment, suite, etc. or type 'skip'):"
                elif "town" not in address_fields_collected:
                    question = "What's your town or city?"
                elif "county" not in address_fields_collected:
                    question = "What's your county?"
                elif "postcode" not in address_fields_collected or not collected_data.get("postcode"):
                    postcode = collected_data.get("postcode", "")
                    if postcode:
                        question = f"Confirm your postcode (currently: {postcode}) or enter a new one:"
                    else:
                        question = "What's your postcode?"
                elif "country" not in address_fields_collected:
                    question = "What's your country? (default: United Kingdom, or type 'skip' to use default):"
                else:
                    question = "Address collection complete. Moving to next step..."
        
        if "{company_name}" in question and "company_verification_data" in collected_data:
            comp_data = collected_data.get("company_verification_data", {})
            comp_info = comp_data.get("company_info", {})
            company_name = comp_info.get("company_name") or "the company"
            question = question.replace("{company_name}", str(company_name))
        
        if "{directors_list}" in question and "company_verification_data" in collected_data:
            comp_data = collected_data.get("company_verification_data", {})
            directors = comp_data.get("directors", [])
            if directors:
                dir_list = "\n".join([f"- {d.get('name', 'Unknown')}" for d in directors[:10]])  # Limit to 10
                question = question.replace("{directors_list}", f"\n\nDirectors found:\n{dir_list}\n")
            else:
                question = question.replace("{directors_list}", "\n\nNo directors found in Companies House records.")
        
        if "{director_index}" in question:
            directors_collected = collected_data.get("directors_collected", [])
            current_index = len(directors_collected) + 1
            total_directors = len(collected_data.get("company_verification_data", {}).get("directors", []))
            question = question.replace("{director_index}", f"{current_index} of {total_directors}")
        
        if "{summary}" in question:
            summary = self._generate_summary(collected_data, user_role)
            question = question.replace("{summary}", str(summary) if summary else "No data collected yet.")
        
        # Replace asset/liability placeholders
        if "{total_assets}" in question or "{total_liabilities}" in question or "{net_worth}" in question:
            total_assets = (
                float(collected_data.get("assets_real_estate", 0) or 0) +
                float(collected_data.get("assets_investments", 0) or 0) +
                float(collected_data.get("assets_other", 0) or 0) +
                float(collected_data.get("total_assets", 0) or 0)
            )
            total_liabilities = (
                float(collected_data.get("liabilities_mortgages", 0) or 0) +
                float(collected_data.get("liabilities_loans", 0) or 0) +
                float(collected_data.get("liabilities_other", 0) or 0) +
                float(collected_data.get("existing_debts", 0) or 0)
            )
            net_worth = total_assets - total_liabilities
            
            question = question.replace("{total_assets}", f"{total_assets:,.0f}")
            question = question.replace("{total_liabilities}", f"{total_liabilities:,.0f}")
            question = question.replace("{net_worth}", f"{net_worth:,.0f}")
        
        # Add progress indicator to questions
        steps = self.get_steps_for_role(user_role)
        current_step_index = steps.index(step) if step in steps else 0
        progress_percentage = int((current_step_index / len(steps)) * 100) if steps else 0
        
        # Add progress message to question
        if step != "welcome" and step != "complete" and step != "review":
            progress_msg = f"\n\n📊 Progress: {progress_percentage}% complete ({current_step_index + 1} of {len(steps)} steps)"
            question = question + progress_msg
        
        return {
            **question_template,
            "question": question,
            "progress": progress_percentage,
            "step_number": current_step_index + 1,
            "total_steps": len(steps),
        }
    
    def _generate_summary(self, collected_data: Dict[str, Any], user_role: str) -> str:
        """Generate a summary of collected data for review."""
        if not collected_data:
            return "No data collected yet."
        
        summary_parts = []
        
        first_name = collected_data.get("first_name")
        last_name = collected_data.get("last_name")
        if first_name and last_name:
            summary_parts.append(f"Name: {first_name} {last_name}")
        
        phone_number = collected_data.get("phone_number")
        if phone_number:
            summary_parts.append(f"Phone: {phone_number}")
        
        postcode = collected_data.get("postcode")
        if postcode:
            summary_parts.append(f"Postcode: {postcode}")
        
        company_reg = collected_data.get("company_registration_number")
        if company_reg:
            summary_parts.append(f"Company: {company_reg}")
        
        annual_income = collected_data.get("annual_income")
        if annual_income:
            try:
                summary_parts.append(f"Income: £{float(annual_income):,.0f}")
            except (ValueError, TypeError):
                summary_parts.append(f"Income: {annual_income}")
        
        return "\n".join(summary_parts) if summary_parts else "No data collected yet."
    
    def _get_documents_question(self, user_role: str, collected_data: Dict[str, Any]) -> str:
        """Generate the documents collection question with required documents list."""
        doc_status = self.check_uploaded_documents(collected_data, user_role)
        missing_docs = doc_status["missing_documents"]
        uploaded_docs = doc_status["uploaded_documents"]
        uploaded_count = doc_status.get("uploaded_count", 0)
        required_count = doc_status.get("required_count", 0)
        
        if user_role == "Borrower":
            question = """📄 **REQUIRED DOCUMENTS FOR YOUR FUNDING APPLICATION**

To complete your FCA-compliant funding application, I need the following documents. Each document is required for specific compliance and assessment purposes:

"""
            
            # List all required documents with explanations
            required_docs = self.get_required_documents(user_role)
            doc_num = 1
            for doc in required_docs:
                is_required = True
                if "required_if" in doc:
                    if not collected_data.get(doc["required_if"]):
                        is_required = False
                
                if is_required:
                    # Check if uploaded (simple check - in production, use better matching)
                    is_uploaded = doc in uploaded_docs or uploaded_count >= required_count
                    status_icon = "✅" if is_uploaded else "❌"
                    
                    question += f"""{status_icon} **{doc_num}. {doc['name']}**
   • What: {doc['description']}
   • Why needed: {doc['required_for']}
   • Required for: FCA compliance and lender assessment
   
"""
                    doc_num += 1
            
            # Show status
            if len(missing_docs) == 0 and uploaded_count > 0:
                question += "\n✅ **All required documents have been uploaded!**\n\nYou can proceed to review your application."
            elif uploaded_count > 0:
                question += f"\n⚠️ **IMPORTANT: You still need to upload {len(missing_docs)} more required document(s):**\n\n"
                for doc in missing_docs:
                    question += f"   ❌ **{doc['name']}**\n"
                    question += f"      Required for: {doc['required_for']}\n\n"
                
                question += "**Please upload the missing documents now.** Your application cannot proceed until all required documents are uploaded.\n\n"
                question += "You can drag and drop files here or click to browse. Multiple files can be uploaded at once."
            else:
                question += "\n⚠️ **NO DOCUMENTS UPLOADED YET**\n\n"
                question += "**Please upload all required documents now.** Your application cannot proceed until all required documents are uploaded.\n\n"
                question += "You can drag and drop files here or click to browse. Multiple files can be uploaded at once."
            
            question += "\n\n**Note:** All documents are securely stored and only shared with lenders after you give explicit consent."
            
            return question
        
        return "Please upload the required documents for your application."
    
    def _get_funding_type_options(self) -> list:
        """Get list of funding type options for selection."""
        return [
            "Development Finance",
            "Senior Debt/Development Finance",
            "Commercial Mortgages",
            "Mortgage Finance",
            "Equity Finance",
            "Revenue Based Funding",
            "Merchant Cash Advance",
            "Term Loans (Peer-to-Peer)",
            "Bank Overdraft",
            "Business Credit Cards",
            "Intellectual Property (IP) Funding",
            "Stock Finance",
            "Asset Finance",
            "Factoring / Invoice Discounting",
            "Trade Finance",
            "Export Finance",
            "Public Sector Funding (Start Up Loan)",
        ]
    
    def _get_funding_type_question(self, collected_data: Dict[str, Any]) -> str:
        """Generate funding type selection question."""
        question = """💰 **WHAT TYPE OF FUNDING DO YOU NEED?**

BuildFund specializes in Property & Development Finance, but we also support various alternative business finance options. Please select the type of funding that best matches your needs:

**Property & Development Finance:**
• Development Finance - For property development projects
• Senior Debt/Development Finance - Senior debt for development
• Commercial Mortgages - Mortgages for commercial property
• Mortgage Finance - Traditional mortgage finance
• Equity Finance - Equity investment

**Alternative Business Finance:**
• Revenue Based Funding - Funding based on recurring revenue
• Merchant Cash Advance - Quick capital based on card sales
• Term Loans (Peer-to-Peer) - P2P loans with competitive rates
• Bank Overdraft - Flexible overdraft facility
• Business Credit Cards - Business credit cards

**Asset-Based Finance:**
• Intellectual Property (IP) Funding - Finance secured against IP assets
• Stock Finance - Finance against inventory
• Asset Finance - Finance for equipment, vehicles, machinery
• Factoring / Invoice Discounting - Release cash from invoices

**Trade & Export:**
• Trade Finance - Finance for import/export transactions
• Export Finance - Specialized finance for export transactions

**Public Sector:**
• Public Sector Funding (Start Up Loan) - Government-backed startup loans

**Which type of funding do you need?**"""
        
        return question
    
    def get_funding_type_specific_questions(self, funding_type: str) -> list:
        """Get additional questions required for a specific funding type."""
        questions = []
        
        # Map funding type display name to code
        funding_type_map = {
            "Development Finance": "development_finance",
            "Senior Debt/Development Finance": "senior_debt",
            "Commercial Mortgages": "commercial_mortgage",
            "Mortgage Finance": "mortgage",
            "Equity Finance": "equity",
            "Revenue Based Funding": "revenue_based",
            "Merchant Cash Advance": "merchant_cash_advance",
            "Term Loans (Peer-to-Peer)": "term_loan_p2p",
            "Bank Overdraft": "bank_overdraft",
            "Business Credit Cards": "business_credit_card",
            "Intellectual Property (IP) Funding": "ip_funding",
            "Stock Finance": "stock_finance",
            "Asset Finance": "asset_finance",
            "Factoring / Invoice Discounting": "factoring",
            "Trade Finance": "trade_finance",
            "Export Finance": "export_finance",
            "Public Sector Funding (Start Up Loan)": "public_sector_startup",
        }
        
        funding_code = funding_type_map.get(funding_type, funding_type)
        
        # Revenue Based Funding
        if funding_code == "revenue_based":
            questions.extend([
                {
                    "step": "revenue_based_monthly_revenue",
                    "question": "What is your average monthly recurring revenue? (Enter amount in GBP)",
                    "field": "monthly_revenue",
                    "type": "number",
                    "required": True,
                },
                {
                    "step": "revenue_based_revenue_growth",
                    "question": "What is your year-over-year revenue growth percentage? (e.g., 25 for 25%)",
                    "field": "revenue_growth_percentage",
                    "type": "number",
                    "required": False,
                },
                {
                    "step": "revenue_based_customer_base",
                    "question": "How many active customers/clients do you have?",
                    "field": "customer_count",
                    "type": "number",
                    "required": False,
                },
            ])
        
        # Merchant Cash Advance
        elif funding_code == "merchant_cash_advance":
            questions.extend([
                {
                    "step": "mca_monthly_card_sales",
                    "question": "What is your average monthly card sales/processing volume? (Enter amount in GBP)",
                    "field": "monthly_card_sales",
                    "type": "number",
                    "required": True,
                },
                {
                    "step": "mca_processor",
                    "question": "Who is your payment processor? (e.g., Stripe, Square, Worldpay)",
                    "field": "payment_processor",
                    "type": "text",
                    "required": False,
                },
            ])
        
        # IP Funding
        elif funding_code == "ip_funding":
            questions.extend([
                {
                    "step": "ip_type",
                    "question": "What type of IP assets do you have? (Select all that apply: Patents, Trademarks, Copyrights, Trade Secrets)",
                    "field": "ip_types",
                    "type": "text",
                    "required": True,
                },
                {
                    "step": "ip_valuation",
                    "question": "Do you have a professional IP valuation? If yes, what is the estimated value? (Enter amount in GBP, or 'no' if not valued)",
                    "field": "ip_valuation",
                    "type": "text",
                    "required": False,
                },
            ])
        
        # Stock Finance
        elif funding_code == "stock_finance":
            questions.extend([
                {
                    "step": "stock_value",
                    "question": "What is the current value of your inventory/stock? (Enter amount in GBP)",
                    "field": "stock_value",
                    "type": "number",
                    "required": True,
                },
                {
                    "step": "stock_turnover",
                    "question": "What is your average stock turnover period? (Enter number of days)",
                    "field": "stock_turnover_days",
                    "type": "number",
                    "required": False,
                },
            ])
        
        # Asset Finance
        elif funding_code == "asset_finance":
            questions.extend([
                {
                    "step": "asset_type",
                    "question": "What type of assets do you need to finance? (e.g., Equipment, Vehicles, Machinery)",
                    "field": "asset_type",
                    "type": "text",
                    "required": True,
                },
                {
                    "step": "asset_value",
                    "question": "What is the total value of assets you need to finance? (Enter amount in GBP)",
                    "field": "asset_value",
                    "type": "number",
                    "required": True,
                },
            ])
        
        # Factoring / Invoice Discounting
        elif funding_code == "factoring":
            questions.extend([
                {
                    "step": "factoring_invoice_value",
                    "question": "What is the total value of your outstanding invoices? (Enter amount in GBP)",
                    "field": "outstanding_invoice_value",
                    "type": "number",
                    "required": True,
                },
                {
                    "step": "factoring_payment_terms",
                    "question": "What are your typical customer payment terms? (e.g., 30 days, 60 days)",
                    "field": "payment_terms_days",
                    "type": "number",
                    "required": False,
                },
            ])
        
        # Trade Finance
        elif funding_code == "trade_finance":
            questions.extend([
                {
                    "step": "trade_transaction_value",
                    "question": "What is the value of the trade transaction you need to finance? (Enter amount in GBP)",
                    "field": "trade_transaction_value",
                    "type": "number",
                    "required": True,
                },
                {
                    "step": "trade_countries",
                    "question": "Which countries are involved in the trade? (e.g., UK to USA)",
                    "field": "trade_countries",
                    "type": "text",
                    "required": False,
                },
            ])
        
        # Export Finance
        elif funding_code == "export_finance":
            questions.extend([
                {
                    "step": "export_value",
                    "question": "What is the value of the export transaction? (Enter amount in GBP)",
                    "field": "export_value",
                    "type": "number",
                    "required": True,
                },
                {
                    "step": "export_destination",
                    "question": "What is the destination country for the export?",
                    "field": "export_destination",
                    "type": "text",
                    "required": True,
                },
            ])
        
        # For property/development finance types, ask property-specific questions
        elif funding_code in ["development_finance", "senior_debt", "commercial_mortgage", "mortgage"]:
            questions.extend([
                {
                    "step": "property_address",
                    "question": "What is the address of the property?",
                    "field": "property_address",
                    "type": "text",
                    "required": True,
                },
                {
                    "step": "property_value",
                    "question": "What is the current or estimated property value? (Enter amount in GBP)",
                    "field": "property_value",
                    "type": "number",
                    "required": True,
                },
                {
                    "step": "loan_purpose",
                    "question": "What is the purpose of the loan? (e.g., Purchase, Refinance, Development)",
                    "field": "loan_purpose",
                    "type": "text",
                    "required": True,
                },
            ])
        
        return questions
