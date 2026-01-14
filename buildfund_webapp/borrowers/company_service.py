"""Service for automatically processing and saving Companies House data to borrower profile."""
from __future__ import annotations

from typing import Dict, Any, List
from django.utils import timezone
from django.db import transaction
from documents.models import Document, DocumentType
from verification.services import HMRCVerificationService


class CompanyDataProcessor:
    """Processes and saves Companies House data to borrower profile."""
    
    def __init__(self):
        self.hmrc_service = HMRCVerificationService()
    
    @transaction.atomic
    def process_and_save_company_data(self, borrower_profile, company_number: str) -> Dict[str, Any]:
        """
        Automatically fetch, process, and save all company data from Companies House.
        
        Returns:
            Dict with processing results and saved data
        """
        results = {
            "company_info": None,
            "directors": [],
            "shareholders": [],
            "accounts_documents": [],
            "charges_summary": None,
            "errors": [],
        }
        
        try:
            # 1. Get company info
            company_info = self.hmrc_service.get_company_info(company_number)
            if "error" in company_info:
                results["errors"].append(f"Failed to get company info: {company_info.get('error')}")
                return results
            
            results["company_info"] = company_info
            
            # 2. Get and process directors
            officers_data = self.hmrc_service.get_company_officers(company_number)
            if "error" not in officers_data:
                directors = self._process_directors(officers_data)
                results["directors"] = directors
                borrower_profile.directors_data = directors
            
            # 3. Get and process shareholders/PSCs
            pscs_data = self.hmrc_service.get_company_pscs(company_number)
            if "error" not in pscs_data:
                shareholders = self._process_shareholders(pscs_data)
                results["shareholders"] = shareholders
                borrower_profile.shareholders_data = shareholders
            
            # 4. Get filing history and save accounts documents
            filing_history = self.hmrc_service.get_company_filing_history(company_number)
            if "error" not in filing_history:
                accounts_docs = self._save_accounts_documents(borrower_profile, company_number, filing_history)
                results["accounts_documents"] = accounts_docs
            
            # 5. Get and summarize charges
            charges_data = self.hmrc_service.get_company_charges(company_number)
            if "error" not in charges_data:
                charges_summary = self.hmrc_service.summarize_charges(charges_data)
                results["charges_summary"] = charges_summary
                # Store charges summary in dedicated field
                borrower_profile.charges_summary = charges_summary
            
            # 6. Store full company data
            borrower_profile.company_data = {
                **(borrower_profile.company_data or {}),
                "company_info": company_info,
                "company_number": company_number,
                "last_updated": timezone.now().isoformat(),
            }
            borrower_profile.company_verified_at = timezone.now()
            borrower_profile.registration_number = company_number
            borrower_profile.company_name = company_info.get("company_name", "")
            
            borrower_profile.save()
            
        except Exception as e:
            results["errors"].append(f"Error processing company data: {str(e)}")
        
        return results
    
    def _process_directors(self, officers_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Process officers data to extract active directors with full details."""
        directors = []
        
        if "items" not in officers_data:
            return directors
        
        for officer in officers_data["items"]:
            if officer.get("officer_role") == "director" and not officer.get("resigned_on"):
                director_data = {
                    "name": officer.get("name", ""),
                    "nationality": officer.get("nationality", ""),
                    "occupation": officer.get("occupation", ""),
                    "appointed_on": officer.get("appointed_on", ""),
                    "officer_role": officer.get("officer_role", ""),
                    "country_of_residence": officer.get("country_of_residence", ""),
                    "date_of_birth": officer.get("date_of_birth", {}),
                    "address": officer.get("address", {}),
                    "links": officer.get("links", {}),
                }
                directors.append(director_data)
        
        return directors
    
    def _process_shareholders(self, pscs_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Process PSCs data to extract shareholders with ownership details."""
        shareholders = []
        
        if "items" not in pscs_data:
            return shareholders
        
        for psc in pscs_data["items"]:
            if psc.get("ceased_on") is None:  # Only active PSCs
                natures_of_control = psc.get("natures_of_control", [])
                ownership_percentage = None
                
                # Extract ownership percentage from natures_of_control
                for nature in natures_of_control:
                    if "percentage" in nature:
                        ownership_percentage = nature.get("percentage")
                        break
                
                shareholder_data = {
                    "name": psc.get("name", ""),
                    "kind": psc.get("kind", ""),
                    "natures_of_control": natures_of_control,
                    "ownership_percentage": ownership_percentage,
                    "date_of_birth": psc.get("date_of_birth", {}),
                    "nationality": psc.get("nationality", ""),
                    "country_of_residence": psc.get("country_of_residence", ""),
                    "address": psc.get("address", {}),
                    "notified_on": psc.get("notified_on", ""),
                }
                shareholders.append(shareholder_data)
        
        return shareholders
    
    def _save_accounts_documents(self, borrower_profile, company_number: str, filing_history: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Automatically download and save accounts documents from filing history."""
        saved_documents = []
        
        if "items" not in filing_history:
            return saved_documents
        
        # Find accounts documents (last 3 years)
        accounts_filings = []
        for filing in filing_history["items"]:
            category = filing.get("category", "").lower()
            if "accounts" in category or "micro" in category:
                accounts_filings.append(filing)
        
        # Sort by date and take last 3
        accounts_filings = sorted(accounts_filings, key=lambda x: x.get("date", ""), reverse=True)[:3]
        
        # Get or create accounts document type
        accounts_doc_type, _ = DocumentType.objects.get_or_create(
            name="Company Accounts",
            defaults={"category": "company", "description": "Companies House accounts filings"}
        )
        
        for filing in accounts_filings:
            transaction_id = filing.get("transaction_id")
            if not transaction_id:
                continue
            
            try:
                # Download document
                doc_result = self.hmrc_service.get_company_document(company_number, transaction_id)
                if "error" in doc_result:
                    continue
                
                # Create document record
                import base64
                from io import BytesIO
                from django.core.files.base import ContentFile
                
                document_data = base64.b64decode(doc_result["document_data"])
                filename = doc_result.get("filename", f"accounts_{transaction_id}.pdf")
                
                # Create document
                document = Document.objects.create(
                    file_name=filename,
                    file_size=len(document_data),
                    file_type="application/pdf",
                    document_type=accounts_doc_type,
                    uploaded_by=borrower_profile.user,
                )
                
                # Save file content
                document.file.save(filename, ContentFile(document_data), save=True)
                
                # Link to borrower profile
                borrower_profile.documents.add(document)
                
                # Store in company_documents JSON
                if not borrower_profile.company_documents:
                    borrower_profile.company_documents = {}
                if "accounts" not in borrower_profile.company_documents:
                    borrower_profile.company_documents["accounts"] = []
                
                borrower_profile.company_documents["accounts"].append({
                    "document_id": document.id,
                    "transaction_id": transaction_id,
                    "description": filing.get("description", ""),
                    "date": filing.get("date", ""),
                    "filename": filename,
                })
                
                saved_documents.append({
                    "document_id": document.id,
                    "filename": filename,
                    "date": filing.get("date", ""),
                    "description": filing.get("description", ""),
                })
                
            except Exception as e:
                # Log error but continue with other documents
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to save accounts document {transaction_id}: {e}")
                continue
        
        return saved_documents
