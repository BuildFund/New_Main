"""Services for borrower profile management."""
from __future__ import annotations

import os
import requests
from typing import Dict, Any, Optional, List
from django.conf import settings


class CompaniesHouseService:
    """Service for interacting with Companies House API."""
    
    def __init__(self):
        """Initialize the service with API key from environment."""
        api_key = os.environ.get("COMPANIES_HOUSE_API_KEY")
        if not api_key:
            raise ValueError(
                "COMPANIES_HOUSE_API_KEY environment variable is required. "
                "Get your API key from https://developer.company-information.service.gov.uk/"
            )
        self.api_key = api_key.strip()  # Remove any whitespace
        self.base_url = "https://api.company-information.service.gov.uk"
        # Companies House Public Data API uses HTTP Basic Auth
        # Format: API key as username, empty password (api_key:)
        # Reference: https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference
        import base64
        credentials = f"{self.api_key}:"
        encoded_credentials = base64.b64encode(credentials.encode('utf-8')).decode('utf-8')
        self.headers = {
            "Authorization": f"Basic {encoded_credentials}",
            "Accept": "application/json"
        }
    
    def search_company(self, query: str) -> List[Dict[str, Any]]:
        """
        Search for companies by name or number.
        
        Args:
            query: Company name or company number
            
        Returns:
            List of company search results
        """
        url = f"{self.base_url}/search/companies"
        params = {"q": query, "items_per_page": 10}
        
        try:
            response = requests.get(url, params=params, headers=self.headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            return data.get("items", [])
        except requests.HTTPError as e:
            if e.response.status_code == 401:
                error_detail = ""
                try:
                    error_data = e.response.json()
                    error_detail = f" - {error_data.get('error', '')}"
                except:
                    pass
                raise Exception(
                    f"Companies House API authentication failed{error_detail}. "
                    "Please verify your API key is correct and activated at "
                    "https://developer.company-information.service.gov.uk/"
                )
            elif e.response.status_code == 403:
                raise Exception("Companies House API access forbidden. Please check your API key permissions.")
            else:
                raise Exception(f"Companies House API error (HTTP {e.response.status_code}): {str(e)}")
        except requests.RequestException as e:
            raise Exception(f"Companies House API error: {str(e)}")
    
    def get_company_profile(self, company_number: str) -> Dict[str, Any]:
        """
        Get full company profile from Companies House.
        
        Args:
            company_number: UK company number
            
        Returns:
            Complete company profile data
        """
        # Companies House Public Data API endpoint for company profile
        # Reference: https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/company-profile/company-profile
        url = f"{self.base_url}/company/{company_number}"
        
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            raise Exception(f"Companies House API error: {str(e)}")
    
    def get_company_officers(self, company_number: str) -> List[Dict[str, Any]]:
        """
        Get company officers (directors) from Companies House.
        
        Args:
            company_number: UK company number
            
        Returns:
            List of officers
        """
        # Companies House Public Data API endpoint for company officers
        # Reference: https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/officers/list
        url = f"{self.base_url}/company/{company_number}/officers"
        
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            return data.get("items", [])
        except requests.RequestException as e:
            raise Exception(f"Companies House API error: {str(e)}")
    
    def get_company_psc(self, company_number: str) -> List[Dict[str, Any]]:
        """
        Get Persons with Significant Control (PSC) from Companies House.
        
        Args:
            company_number: UK company number
            
        Returns:
            List of PSC entries
        """
        url = f"{self.base_url}/company/{company_number}/persons-with-significant-control"
        
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            return data.get("items", [])
        except requests.RequestException as e:
            raise Exception(f"Companies House API error: {str(e)}")
    
    def get_filing_history(self, company_number: str, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get company filing history from Companies House.
        
        Args:
            company_number: UK company number
            category: Optional category filter (e.g., 'accounts', 'confirmation-statement')
            
        Returns:
            List of filing history items
        """
        url = f"{self.base_url}/company/{company_number}/filing-history"
        params = {"items_per_page": 200}  # Get more items
        if category:
            params["category"] = category
        
        try:
            response = requests.get(url, params=params, headers=self.headers, timeout=15)
            response.raise_for_status()
            data = response.json()
            return data.get("items", [])
        except requests.RequestException as e:
            raise Exception(f"Companies House API error: {str(e)}")
    
    def get_filing_document(self, company_number: str, transaction_id: str) -> bytes:
        """
        Download a filing document from Companies House.
        
        Args:
            company_number: UK company number
            transaction_id: Transaction ID of the filing
            
        Returns:
            Document content as bytes
        """
        url = f"{self.base_url}/company/{company_number}/filing-history/{transaction_id}/document"
        
        try:
            response = requests.get(url, headers=self.headers, timeout=30, stream=True)
            response.raise_for_status()
            return response.content
        except requests.RequestException as e:
            raise Exception(f"Failed to download document: {str(e)}")
    
    def get_accounts(self, company_number: str, years: int = 3) -> List[Dict[str, Any]]:
        """
        Get company accounts from filing history (last N years).
        
        Args:
            company_number: UK company number
            years: Number of years to retrieve (default: 3)
            
        Returns:
            List of account filings with metadata
        """
        from datetime import datetime, timedelta
        
        cutoff_date = datetime.now() - timedelta(days=years * 365)
        
        # Get filing history filtered by accounts category
        filings = self.get_filing_history(company_number, category="accounts")
        
        # Filter by date and sort by date (newest first)
        accounts = []
        for filing in filings:
            filing_date_str = filing.get("date", "")
            if filing_date_str:
                try:
                    filing_date = datetime.strptime(filing_date_str, "%Y-%m-%d")
                    if filing_date >= cutoff_date:
                        accounts.append({
                            "transaction_id": filing.get("transaction_id", ""),
                            "date": filing_date_str,
                            "description": filing.get("description", ""),
                            "category": filing.get("category", ""),
                            "subcategory": filing.get("subcategory", []),
                            "barcode": filing.get("barcode", ""),
                        })
                except ValueError:
                    continue
        
        # Sort by date descending
        accounts.sort(key=lambda x: x.get("date", ""), reverse=True)
        return accounts
    
    def get_confirmation_statements(self, company_number: str) -> List[Dict[str, Any]]:
        """
        Get confirmation statements from filing history.
        
        Args:
            company_number: UK company number
            
        Returns:
            List of confirmation statement filings
        """
        filings = self.get_filing_history(company_number, category="confirmation-statement")
        
        statements = []
        for filing in filings:
            statements.append({
                "transaction_id": filing.get("transaction_id", ""),
                "date": filing.get("date", ""),
                "description": filing.get("description", ""),
                "category": filing.get("category", ""),
                "barcode": filing.get("barcode", ""),
            })
        
        # Sort by date descending
        statements.sort(key=lambda x: x.get("date", ""), reverse=True)
        return statements
    
    def get_incorporation_certificate(self, company_number: str) -> Optional[Dict[str, Any]]:
        """
        Get certificate of incorporation from filing history.
        
        Args:
            company_number: UK company number
            
        Returns:
            Certificate of incorporation filing metadata or None
        """
        filings = self.get_filing_history(company_number)
        
        # Look for incorporation certificate
        for filing in filings:
            description = filing.get("description", "").lower()
            category = filing.get("category", "").lower()
            if "incorporation" in description or "certificate" in description:
                return {
                    "transaction_id": filing.get("transaction_id", ""),
                    "date": filing.get("date", ""),
                    "description": filing.get("description", ""),
                    "category": filing.get("category", ""),
                    "barcode": filing.get("barcode", ""),
                }
        return None
    
    def get_charges(self, company_number: str) -> List[Dict[str, Any]]:
        """
        Get charges (mortgages, debentures) from filing history.
        
        Args:
            company_number: UK company number
            
        Returns:
            List of charge filings
        """
        filings = self.get_filing_history(company_number, category="mortgage")
        
        charges = []
        for filing in filings:
            description = filing.get("description", "").lower()
            # Filter for relevant charge types
            if any(term in description for term in ["charge", "mortgage", "debenture", "security"]):
                charges.append({
                    "transaction_id": filing.get("transaction_id", ""),
                    "date": filing.get("date", ""),
                    "description": filing.get("description", ""),
                    "category": filing.get("category", ""),
                    "subcategory": filing.get("subcategory", []),
                    "barcode": filing.get("barcode", ""),
                })
        
        # Sort by date descending
        charges.sort(key=lambda x: x.get("date", ""), reverse=True)
        return charges
    
    def import_company_data(self, company_number: str, include_documents: bool = True) -> Dict[str, Any]:
        """
        Import complete company data from Companies House.
        
        Args:
            company_number: UK company number
            include_documents: Whether to include filing history and documents (default: True)
            
        Returns:
            Complete company data including profile, officers, PSC, address, and documents
        """
        try:
            # Get company profile (includes registered address)
            profile = self.get_company_profile(company_number)
            
            # Get officers (directors)
            officers = self.get_company_officers(company_number)
            
            # Get PSC (Persons with Significant Control - shareholders with >=25%)
            psc = self.get_company_psc(company_number)
            
            result = {
                "profile": profile,
                "officers": officers,
                "psc": psc,
                "registered_address": profile.get("registered_office_address", {}),
                "company_status": profile.get("company_status", ""),
                "company_type": profile.get("type", ""),
                "date_of_creation": profile.get("date_of_creation", ""),
                "sic_codes": profile.get("sic_codes", []),
                "imported_at": str(profile.get("date_of_creation", "")),
            }
            
            # Optionally include documents (can be slow)
            if include_documents:
                try:
                    # Get last 3 years of accounts
                    accounts = self.get_accounts(company_number, years=3)
                    result["accounts"] = accounts
                    
                    # Get confirmation statements
                    statements = self.get_confirmation_statements(company_number)
                    result["confirmation_statements"] = statements
                    
                    # Get certificate of incorporation
                    incorporation_cert = self.get_incorporation_certificate(company_number)
                    result["incorporation_certificate"] = incorporation_cert
                    
                    # Get charges
                    charges = self.get_charges(company_number)
                    result["charges"] = charges
                except Exception as doc_error:
                    # Don't fail if documents can't be retrieved
                    result["documents_error"] = str(doc_error)
                    result["accounts"] = []
                    result["confirmation_statements"] = []
                    result["incorporation_certificate"] = None
                    result["charges"] = []
            
            return result
        except Exception as e:
            raise Exception(f"Failed to import company data: {str(e)}")


class OpenBankingService:
    """Service for Open Bank Project (OBP) OAuth 1.0a integration."""
    
    def __init__(self):
        """Initialize Open Banking service with OBP credentials from environment."""
        self.consumer_key = os.environ.get("OBP_CONSUMER_KEY")
        self.consumer_secret = os.environ.get("OBP_CONSUMER_SECRET")
        self.base_url = os.environ.get("OBP_BASE_URL", "https://apisandbox.openbankproject.com")
        self.oauth_initiate_url = f"{self.base_url}/oauth/initiate"
        self.oauth_token_url = f"{self.base_url}/oauth/token"
        self.oauth_authorize_url = f"{self.base_url}/oauth/authorize"
        self.direct_login_url = f"{self.base_url}/my/logins/direct"
        
        if not self.consumer_key or not self.consumer_secret:
            raise ValueError(
                "OBP_CONSUMER_KEY and OBP_CONSUMER_SECRET environment variables are required. "
                "Get your credentials from https://apisandbox.openbankproject.com/"
            )
    
    def get_authorization_url(self, borrower_id: str, redirect_uri: str) -> Dict[str, Any]:
        """
        Generate OAuth 1.0a authorization URL for Open Banking.
        
        Args:
            borrower_id: Borrower profile ID
            redirect_uri: OAuth redirect URI
            
        Returns:
            Dictionary with authorization_url and oauth_token_secret (to store temporarily)
        """
        try:
            from requests_oauthlib import OAuth1Session
            
            # Create OAuth1 session
            oauth = OAuth1Session(
                self.consumer_key,
                client_secret=self.consumer_secret,
                callback_uri=redirect_uri
            )
            
            # Step 1: Get request token
            request_token_response = oauth.fetch_request_token(self.oauth_initiate_url)
            oauth_token = request_token_response.get('oauth_token')
            oauth_token_secret = request_token_response.get('oauth_token_secret')
            
            # Step 2: Get authorization URL
            authorization_url = oauth.authorization_url(self.oauth_authorize_url)
            
            return {
                'authorization_url': authorization_url,
                'oauth_token': oauth_token,
                'oauth_token_secret': oauth_token_secret,  # Store temporarily for token exchange
            }
        except ImportError:
            raise Exception(
                "requests-oauthlib is required for Open Banking. "
                "Install it with: pip install requests-oauthlib"
            )
        except Exception as e:
            raise Exception(f"Failed to get authorization URL: {str(e)}")
    
    def exchange_token_for_access(self, oauth_token: str, oauth_token_secret: str, oauth_verifier: str) -> Dict[str, Any]:
        """
        Exchange OAuth request token for access token (OAuth 1.0a Step 3).
        
        Args:
            oauth_token: OAuth token from authorization
            oauth_token_secret: OAuth token secret (stored temporarily)
            oauth_verifier: OAuth verifier from callback
            
        Returns:
            Access token data
        """
        try:
            from requests_oauthlib import OAuth1Session
            
            # Create OAuth1 session with request token
            oauth = OAuth1Session(
                self.consumer_key,
                client_secret=self.consumer_secret,
                resource_owner_key=oauth_token,
                resource_owner_secret=oauth_token_secret,
                verifier=oauth_verifier
            )
            
            # Exchange for access token
            access_token_response = oauth.fetch_access_token(self.oauth_token_url)
            
            return {
                'oauth_token': access_token_response.get('oauth_token'),
                'oauth_token_secret': access_token_response.get('oauth_token_secret'),
            }
        except Exception as e:
            raise Exception(f"Failed to exchange token: {str(e)}")
    
    def get_accounts(self, oauth_token: str, oauth_token_secret: str) -> List[Dict[str, Any]]:
        """
        Get connected bank accounts using OAuth 1.0a access token.
        
        Args:
            oauth_token: OAuth access token
            oauth_token_secret: OAuth access token secret
            
        Returns:
            List of account information
        """
        try:
            from requests_oauthlib import OAuth1Session
            
            oauth = OAuth1Session(
                self.consumer_key,
                client_secret=self.consumer_secret,
                resource_owner_key=oauth_token,
                resource_owner_secret=oauth_token_secret
            )
            
            # Get accounts
            url = f"{self.base_url}/obp/v5.1.0/my/accounts"
            response = oauth.get(url)
            response.raise_for_status()
            data = response.json()
            
            return data.get('accounts', [])
        except Exception as e:
            raise Exception(f"Failed to get accounts: {str(e)}")
    
    def get_account_balance(self, oauth_token: str, oauth_token_secret: str, account_id: str, bank_id: str = "rbs") -> Dict[str, Any]:
        """
        Get account balance.
        
        Args:
            oauth_token: OAuth access token
            oauth_token_secret: OAuth access token secret
            account_id: Bank account ID
            bank_id: Bank ID (default: rbs for sandbox)
            
        Returns:
            Account balance information
        """
        try:
            from requests_oauthlib import OAuth1Session
            
            oauth = OAuth1Session(
                self.consumer_key,
                client_secret=self.consumer_secret,
                resource_owner_key=oauth_token,
                resource_owner_secret=oauth_token_secret
            )
            
            url = f"{self.base_url}/obp/v5.1.0/banks/{bank_id}/accounts/{account_id}/account"
            response = oauth.get(url)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            raise Exception(f"Failed to get account balance: {str(e)}")
    
    def get_transactions(self, oauth_token: str, oauth_token_secret: str, account_id: str, bank_id: str = "rbs", from_date: str = None, to_date: str = None) -> List[Dict[str, Any]]:
        """
        Get account transactions.
        
        Args:
            oauth_token: OAuth access token
            oauth_token_secret: OAuth access token secret
            account_id: Bank account ID
            bank_id: Bank ID (default: rbs for sandbox)
            from_date: Start date (ISO format, optional)
            to_date: End date (ISO format, optional)
            
        Returns:
            List of transactions
        """
        try:
            from requests_oauthlib import OAuth1Session
            
            oauth = OAuth1Session(
                self.consumer_key,
                client_secret=self.consumer_secret,
                resource_owner_key=oauth_token,
                resource_owner_secret=oauth_token_secret
            )
            
            url = f"{self.base_url}/obp/v5.1.0/banks/{bank_id}/accounts/{account_id}/transactions"
            params = {}
            if from_date:
                params['from_date'] = from_date
            if to_date:
                params['to_date'] = to_date
            
            response = oauth.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            return data.get('transactions', [])
        except Exception as e:
            raise Exception(f"Failed to get transactions: {str(e)}")
