"""Services for document validation and processing."""
from __future__ import annotations

import os
import mimetypes
from typing import Dict, Any, Optional
from django.conf import settings


class DocumentValidationService:
    """Service for validating uploaded documents."""
    
    def __init__(self):
        """Initialize validation service."""
        self.max_file_size_mb = 50  # Default max file size
        self.allowed_types = [
            "application/pdf",
            "image/jpeg",
            "image/jpg",
            "image/png",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ]
    
    def validate_document(self, file, document_type=None) -> Dict[str, Any]:
        """
        Validate a document file.
        
        Args:
            file: Uploaded file object
            document_type: Optional DocumentType instance
            
        Returns:
            {
                "valid": bool,
                "score": int (0-100),
                "notes": str,
                "errors": list,
                "warnings": list,
            }
        """
        errors = []
        warnings = []
        score = 100
        
        # Check file size
        max_size = document_type.max_file_size_mb * 1024 * 1024 if document_type else self.max_file_size_mb * 1024 * 1024
        if file.size > max_size:
            errors.append(f"File size exceeds maximum allowed size ({max_size / 1024 / 1024:.0f}MB)")
            score -= 50
        
        # Check file type
        file_type = file.content_type or mimetypes.guess_type(file.name)[0]
        allowed_types = document_type.allowed_file_types if document_type and document_type.allowed_file_types else self.allowed_types
        
        if file_type not in allowed_types:
            errors.append(f"File type {file_type} is not allowed. Allowed types: {', '.join(allowed_types)}")
            score -= 50
        
        # Check file name
        if not file.name or len(file.name) > 255:
            warnings.append("File name is missing or too long")
            score -= 5
        
        # Check if file is empty
        if file.size == 0:
            errors.append("File is empty")
            score -= 100
        
        # Additional validation based on document type
        if document_type:
            if document_type.category == "financial":
                # For financial documents, check if it's a PDF (preferred)
                if file_type != "application/pdf":
                    warnings.append("Financial documents should preferably be in PDF format")
                    score -= 10
            
            elif document_type.category == "identity":
                # For ID documents, check if it's an image or PDF
                if file_type not in ["image/jpeg", "image/png", "application/pdf"]:
                    warnings.append("ID documents should be in image or PDF format")
                    score -= 10
        
        # Calculate final score (ensure it's between 0 and 100)
        score = max(0, min(100, score))
        
        return {
            "valid": len(errors) == 0,
            "score": score,
            "notes": "; ".join(errors + warnings) if (errors + warnings) else "Document validated successfully",
            "errors": errors,
            "warnings": warnings,
            "file_type": file_type,
            "file_size": file.size,
        }


class DocumentAIAssessmentService:
    """Service for AI assessment of documents for underwriting."""
    
    def __init__(self):
        """Initialize AI assessment service."""
        self.openai_api_key = os.environ.get("OPENAI_API_KEY")
        if not self.openai_api_key:
            print("Warning: OPENAI_API_KEY not set. AI assessment will be limited.")
    
    def assess_document(self, document, file_content: Optional[bytes] = None) -> Dict[str, Any]:
        """
        Assess a document using AI.
        
        Args:
            document: Document instance
            file_content: Optional file content bytes
            
        Returns:
            {
                "risk_score": int (0-100),
                "key_findings": list,
                "summary": str,
                "recommendations": str,
            }
        """
        # For now, return a basic assessment
        # In production, this would use OpenAI API to analyze document content
        
        assessment = {
            "risk_score": 50,  # Default neutral score
            "key_findings": [],
            "summary": f"Document {document.file_name} has been assessed.",
            "recommendations": "Review document manually for detailed analysis.",
        }
        
        # Basic assessment based on document type
        if document.document_type:
            if document.document_type.category == "financial":
                assessment["key_findings"].append("Financial document requires detailed review")
                assessment["summary"] = "Financial document detected. Requires analysis of financial data."
            
            elif document.document_type.category == "identity":
                assessment["key_findings"].append("Identity document verified")
                assessment["risk_score"] = 30  # Lower risk for valid ID
                assessment["summary"] = "Identity document appears valid."
            
            elif document.document_type.category == "company":
                assessment["key_findings"].append("Company document requires verification")
                assessment["summary"] = "Company document requires cross-reference with Companies House."
        
        # Adjust risk score based on validation status
        if document.validation_status == "valid":
            assessment["risk_score"] = max(0, assessment["risk_score"] - 10)
        elif document.validation_status == "invalid":
            assessment["risk_score"] = min(100, assessment["risk_score"] + 20)
        
        return assessment
    
    def assess_application(self, application, documents: list) -> Dict[str, Any]:
        """
        Assess an entire application based on all documents.
        
        Args:
            application: Application instance
            documents: List of Document instances
            
        Returns:
            {
                "risk_score": int (0-100),
                "recommendation": str,
                "summary": str,
                "key_findings": list,
                "strengths": list,
                "concerns": list,
                "recommendations": str,
            }
        """
        if not documents:
            return {
                "risk_score": 100,
                "recommendation": "refer",
                "summary": "No documents provided for assessment.",
                "key_findings": ["No documents uploaded"],
                "strengths": [],
                "concerns": ["Missing required documents"],
                "recommendations": "Request borrower to upload required documents.",
            }
        
        # Analyze all documents
        document_scores = []
        key_findings = []
        strengths = []
        concerns = []
        
        for doc in documents:
            doc_assessment = self.assess_document(doc)
            document_scores.append(doc_assessment.get("risk_score", 50))
            key_findings.extend(doc_assessment.get("key_findings", []))
        
        # Calculate overall risk score (average of document scores, weighted by validation)
        valid_docs = [d for d in documents if d.validation_status == "valid"]
        invalid_docs = [d for d in documents if d.validation_status == "invalid"]
        
        if valid_docs:
            strengths.append(f"{len(valid_docs)} document(s) validated successfully")
        
        if invalid_docs:
            concerns.append(f"{len(invalid_docs)} document(s) failed validation")
        
        # Check for required document types
        required_types = ["identity", "financial", "company"]
        found_types = set()
        for doc in documents:
            if doc.document_type and doc.document_type.category:
                found_types.add(doc.document_type.category)
        
        missing_types = set(required_types) - found_types
        if missing_types:
            concerns.append(f"Missing document categories: {', '.join(missing_types)}")
        
        # Calculate overall risk score
        if document_scores:
            avg_score = sum(document_scores) / len(document_scores)
        else:
            avg_score = 50
        
        # Adjust based on validation status
        if len(invalid_docs) > 0:
            avg_score += 20
        if len(valid_docs) == len(documents) and len(documents) >= 3:
            avg_score -= 15
        
        risk_score = max(0, min(100, int(avg_score)))
        
        # Determine recommendation
        if risk_score < 30:
            recommendation = "approve"
        elif risk_score < 50:
            recommendation = "approve_with_conditions"
        elif risk_score < 70:
            recommendation = "refer"
        else:
            recommendation = "decline"
        
        return {
            "risk_score": risk_score,
            "recommendation": recommendation,
            "summary": f"Application assessed with risk score of {risk_score}. {len(valid_docs)}/{len(documents)} documents validated.",
            "key_findings": key_findings[:10],  # Limit to 10 findings
            "strengths": strengths,
            "concerns": concerns,
            "recommendations": self._generate_recommendations(risk_score, concerns, strengths),
        }
    
    def _generate_recommendations(self, risk_score: int, concerns: list, strengths: list) -> str:
        """Generate recommendations based on assessment."""
        recommendations = []
        
        if risk_score < 30:
            recommendations.append("Application appears low risk. Consider fast-track approval.")
        elif risk_score < 50:
            recommendations.append("Application is acceptable with standard conditions.")
        elif risk_score < 70:
            recommendations.append("Application requires manual review. Some concerns identified.")
        else:
            recommendations.append("Application has significant risk factors. Detailed review required.")
        
        if concerns:
            recommendations.append(f"Address the following concerns: {', '.join(concerns[:3])}")
        
        if strengths:
            recommendations.append(f"Positive factors: {', '.join(strengths[:3])}")
        
        return " ".join(recommendations)
