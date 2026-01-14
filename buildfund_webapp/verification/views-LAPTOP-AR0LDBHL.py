"""Views for company and director verification."""
from __future__ import annotations

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from core.validators import validate_company_number, sanitize_string
from accounts.permissions import IsBorrower as IsBorrowerPermission
from accounts.throttles import VerificationThrottle

from .models import CompanyVerification, DirectorVerification
from .services import HMRCVerificationService
from .serializers import CompanyVerificationSerializer, DirectorVerificationSerializer


class CompanyVerificationViewSet(viewsets.ModelViewSet):
    """ViewSet for company verification."""
    
    serializer_class = CompanyVerificationSerializer
    permission_classes = [permissions.IsAuthenticated, IsBorrowerPermission]
    throttle_classes = [VerificationThrottle]  # Prevent API abuse
    
    def get_queryset(self):
        """Return verifications for the current borrower."""
        if hasattr(self.request.user, "borrowerprofile"):
            return CompanyVerification.objects.filter(
                borrower_profile=self.request.user.borrowerprofile
            )
        return CompanyVerification.objects.none()
    
    @action(detail=False, methods=["post"])
    def verify(self, request):
        """
        Verify a company using HMRC API.
        
        Expected payload:
        {
            "company_number": "12345678",
            "company_name": "Example Company Ltd"
        }
        """
        company_number = request.data.get("company_number")
        company_name = request.data.get("company_name")
        
        if not company_number or not company_name:
            return Response(
                {"error": "company_number and company_name are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Validate and sanitize inputs
        try:
            company_number = validate_company_number(company_number)
            company_name = sanitize_string(company_name, max_length=255)
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        borrower_profile = request.user.borrowerprofile
        
        # Check if verification already exists
        verification, created = CompanyVerification.objects.get_or_create(
            borrower_profile=borrower_profile,
            defaults={
                "company_number": company_number,
                "company_name": company_name,
                "status": "pending",
            },
        )
        
        # Perform verification
        service = HMRCVerificationService()
        result = service.verify_company(company_number, company_name)
        
        # Update verification record
        verification.verification_data = result.get("company_info", {})
        verification.status = "verified" if result["verified"] else "failed"
        if result["verified"]:
            verification.verified_at = timezone.now()
        else:
            verification.error_message = result.get("message", "")
        verification.save()
        
        serializer = self.get_serializer(verification)
        return Response(serializer.data)
    
    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def search_companies(self, request):
        """Search for companies by name."""
        company_name = request.query_params.get("company_name") or request.query_params.get("q")
        if not company_name:
            return Response(
                {"error": "company_name or q parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        items_per_page = int(request.query_params.get("items_per_page", 20))
        
        try:
            service = HMRCVerificationService()
        except ValueError as e:
            return Response(
                {"error": "Company verification service is not configured. Please contact support."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        
        search_results = service.search_companies_by_name(company_name, items_per_page)
        
        if "error" in search_results:
            return Response(
                {"error": f"Failed to search companies: {search_results.get('error', 'Unknown error')}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        
        # Format results for frontend
        companies = []
        for item in search_results.get("items", []):
            companies.append({
                "company_number": item.get("company_number", ""),
                "company_name": item.get("title", ""),
                "company_status": item.get("company_status", ""),
                "company_type": item.get("company_type", ""),
                "address_snippet": item.get("address_snippet", ""),
                "date_of_creation": item.get("date_of_creation", ""),
            })
        
        return Response({
            "companies": companies,
            "total_results": search_results.get("total_results", 0),
            "page_number": search_results.get("page_number", 1),
        })
    
    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def get_full_company_details(self, request):
        """Get full company details including officers, PSCs, and filing history."""
        company_number = request.query_params.get("company_number")
        if not company_number:
            return Response(
                {"error": "company_number parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        try:
            company_number = validate_company_number(company_number)
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Check if API key is configured
        try:
            service = HMRCVerificationService()
        except ValueError as e:
            return Response(
                {
                    "error": str(e),
                    "message": "Companies House API key is not configured. Please add HMRC_API_KEY to your .env file. Get a free key from: https://developer.company-information.service.gov.uk/"
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        
        # Get all company data
        company_info = service.get_company_info(company_number)
        if "error" in company_info:
            return Response(
                {"error": f"Failed to fetch company information: {company_info.get('error', 'Unknown error')}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        
        officers_data = service.get_company_officers(company_number)
        if "error" in officers_data:
            # Log but continue - officers are optional
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to fetch officers for company {company_number}: {officers_data.get('error')}")
            officers_data = {"items": []}
        
        pscs_data = service.get_company_pscs(company_number)
        if "error" in pscs_data:
            # Log but continue - PSCs are optional
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to fetch PSCs for company {company_number}: {pscs_data.get('error')}")
            pscs_data = {"items": []}
        
        filing_history = service.get_company_filing_history(company_number)
        if "error" in filing_history:
            # Log but continue - filing history is optional
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to fetch filing history for company {company_number}: {filing_history.get('error')}")
            filing_history = {"items": []}
        
        # Filter active directors (not resigned)
        active_directors = []
        if "items" in officers_data:
            for officer in officers_data["items"]:
                if officer.get("officer_role") == "director" and not officer.get("resigned_on"):
                    active_directors.append({
                        "name": officer.get("name", ""),
                        "nationality": officer.get("nationality", ""),
                        "occupation": officer.get("occupation", ""),
                        "appointed_on": officer.get("appointed_on", ""),
                    })
        
        # Get PSCs
        pscs = []
        if "items" in pscs_data:
            for psc in pscs_data["items"]:
                if psc.get("ceased_on") is None:  # Only active PSCs
                    pscs.append({
                        "name": psc.get("name", ""),
                        "kind": psc.get("kind", ""),
                        "natures_of_control": psc.get("natures_of_control", []),
                    })
        
        # Organize filing history documents
        documents = {
            "incorporation_cert": [],
            "accounts": [],
            "charges": [],
            "confirmation_statements": [],
        }
        
        if "items" in filing_history:
            for filing in filing_history["items"]:
                category = filing.get("category", "").lower()
                transaction_id = filing.get("transaction_id", "")
                description = filing.get("description", "")
                date = filing.get("date", "")
                
                doc_info = {
                    "transaction_id": transaction_id,
                    "description": description,
                    "date": date,
                    "category": category,
                }
                
                if "incorporation" in category or "certificate" in description.lower():
                    documents["incorporation_cert"].append(doc_info)
                elif "accounts" in category or "micro" in category:
                    documents["accounts"].append(doc_info)
                elif "charge" in category:
                    documents["charges"].append(doc_info)
                elif "confirmation" in category or "annual return" in description.lower():
                    documents["confirmation_statements"].append(doc_info)
        
        # Limit accounts to last 3 years
        documents["accounts"] = sorted(documents["accounts"], key=lambda x: x.get("date", ""), reverse=True)[:3]
        
        # Get charges summary
        charges_data = service.get_company_charges(company_number)
        charges_summary = None
        if "error" not in charges_data:
            summary = service.summarize_charges(charges_data)
            # Format for frontend - flatten the charges_summary structure
            # Handle case where charges_summary can be a list (when empty) or dict (when there are charges)
            charges_list = summary.get("charges_summary", {})
            if isinstance(charges_list, dict):
                # Normal case: charges_summary is a dict with "active" and "satisfied" keys
                active = charges_list.get("active", [])
                satisfied = charges_list.get("satisfied", [])
            else:
                # Empty case: charges_summary is a list (or empty)
                active = []
                satisfied = []
            
            charges_summary = {
                "total_charges": summary.get("total_charges", 0),
                "active_charges": summary.get("active_charges", 0),
                "satisfied_charges": summary.get("satisfied_charges", 0),
                "charges": (active + satisfied)[:10],  # Limit to 10 for display
            }
        
        # Format response to match frontend expectations
        response_data = {
            "company_number": company_number,
            "company_name": company_info.get("company_name", ""),
            "company_type": company_info.get("company_type", ""),
            "company_status": company_info.get("company_status", ""),
            "date_of_creation": company_info.get("date_of_creation", ""),
            "incorporation_date": company_info.get("date_of_creation", ""),
            "registered_address": company_info.get("registered_office_address", {}),
            "directors": active_directors,
            "active_directors": active_directors,
            "pscs": pscs,
            "charges_summary": charges_summary,
            "incorporation_certificates": documents.get("incorporation_cert", []),
            "accounts_documents": documents.get("accounts", []),
            "charges_documents": documents.get("charges", []),
            "confirmation_statements": documents.get("confirmation_statements", []),
            "documents": {
                "incorporation_cert": documents.get("incorporation_cert", []),
                "accounts": documents.get("accounts", []),
                "charges": documents.get("charges", []),
                "confirmation_statements": documents.get("confirmation_statements", []),
            },
        }
        
        return Response(response_data)
    
    @action(detail=False, methods=["post"])
    def download_company_document(self, request):
        """Download a company document from Companies House."""
        company_number = request.data.get("company_number")
        transaction_id = request.data.get("transaction_id")
        
        if not company_number or not transaction_id:
            return Response(
                {"error": "company_number and transaction_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        try:
            company_number = validate_company_number(company_number)
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        service = HMRCVerificationService()
        result = service.get_company_document(company_number, transaction_id)
        
        if "error" in result:
            return Response(
                {"error": result["error"]},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        
        return Response(result)


class DirectorVerificationViewSet(viewsets.ModelViewSet):
    """ViewSet for director verification."""
    
    serializer_class = DirectorVerificationSerializer
    permission_classes = [permissions.IsAuthenticated, IsBorrowerPermission]
    throttle_classes = [VerificationThrottle]  # Prevent API abuse
    
    def get_queryset(self):
        """Return verifications for the current borrower."""
        if hasattr(self.request.user, "borrowerprofile"):
            return DirectorVerification.objects.filter(
                borrower_profile=self.request.user.borrowerprofile
            )
        return DirectorVerification.objects.none()
    
    @action(detail=False, methods=["post"])
    def verify(self, request):
        """
        Verify a director using HMRC API.
        
        Expected payload:
        {
            "company_number": "12345678",
            "director_name": "John Doe",
            "date_of_birth": "1980-01-15"  # Optional
        }
        """
        company_number = request.data.get("company_number")
        director_name = request.data.get("director_name")
        date_of_birth = request.data.get("date_of_birth")
        
        if not company_number or not director_name:
            return Response(
                {"error": "company_number and director_name are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Validate and sanitize inputs
        try:
            company_number = validate_company_number(company_number)
            director_name = sanitize_string(director_name, max_length=255)
            # Validate date format if provided
            if date_of_birth:
                from datetime import datetime
                try:
                    datetime.strptime(date_of_birth, "%Y-%m-%d")
                except ValueError:
                    return Response(
                        {"error": "date_of_birth must be in YYYY-MM-DD format"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        borrower_profile = request.user.borrowerprofile
        
        # Perform verification
        service = HMRCVerificationService()
        result = service.verify_director(company_number, director_name, date_of_birth)
        
        # Create or update verification record
        verification = DirectorVerification.objects.create(
            borrower_profile=borrower_profile,
            company_number=company_number,
            director_name=director_name,
            date_of_birth=date_of_birth if date_of_birth else None,
            status="verified" if result["verified"] else "failed",
            verification_data=result.get("director_info", {}),
            error_message="" if result["verified"] else result.get("message", ""),
            verified_at=timezone.now() if result["verified"] else None,
        )
        
        serializer = self.get_serializer(verification)
        return Response(serializer.data)
