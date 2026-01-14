"""Service for generating underwriter reports using OpenAI."""
from __future__ import annotations

import json
import os
from typing import Dict, Any, Optional
from django.conf import settings
from openai import OpenAI

from .models import Application, UnderwriterReport
from .services import ReportInputBuilder


# Strict JSON output schema
REPORT_SCHEMA = {
    "type": "object",
    "properties": {
        "meta": {
            "type": "object",
            "properties": {
                "report_version": {"type": "string"},
                "generated_at": {"type": "string"},
                "application_id": {"type": "integer"},
            },
            "required": ["report_version", "generated_at", "application_id"]
        },
        "executiveSummary": {
            "type": "object",
            "properties": {
                "borrower_name": {"type": "string"},
                "facility_amount": {"type": "number"},
                "facility_term": {"type": "integer"},
                "recommendation": {"type": "string"},
                "risk_rating": {"type": "string"},
                "key_highlights": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["borrower_name", "facility_amount", "facility_term", "recommendation", "risk_rating", "key_highlights"]
        },
        "facilityRequest": {
            "type": "object",
            "properties": {
                "amount": {"type": "number"},
                "term_months": {"type": "integer"},
                "purpose": {"type": "string"},
                "security": {"type": "string"},
                "repayment_method": {"type": "string"},
            },
            "required": ["amount", "term_months", "purpose", "security", "repayment_method"]
        },
        "borrowerCompanyOverview": {
            "type": "object",
            "properties": {
                "company_name": {"type": "string"},
                "company_number": {"type": "string"},
                "company_status": {"type": "string"},
                "incorporation_date": {"type": "string"},
                "trading_address": {"type": "string"},
                "sic_codes": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["company_name", "company_number", "company_status", "incorporation_date", "trading_address", "sic_codes"]
        },
        "applicantsAndGuarantors": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "role": {"type": "string"},
                    "nationality": {"type": "string"},
                    "employment_status": {"type": "string"},
                    "net_monthly_income": {"type": ["number", "null"]},
                },
                "required": ["name", "role", "nationality", "employment_status"]
            }
        },
        "financialOverview": {
            "type": "object",
            "properties": {
                "total_income": {"type": ["number", "null"]},
                "total_expenditure": {"type": ["number", "null"]},
                "total_assets": {"type": ["number", "null"]},
                "total_liabilities": {"type": ["number", "null"]},
                "net_worth": {"type": ["number", "null"]},
            }
        },
        "strengths": {
            "type": "array",
            "items": {"type": "string"}
        },
        "risksAndMitigants": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "risk": {"type": "string"},
                    "severity": {"type": "string"},
                    "mitigant": {"type": "string"},
                },
                "required": ["risk", "severity", "mitigant"]
            }
        },
        "queries": {
            "type": "array",
            "items": {"type": "string"}
        },
        "conditionsPrecedent": {
            "type": "array",
            "items": {"type": "string"}
        },
        "suggestedCovenants": {
            "type": "array",
            "items": {"type": "string"}
        },
        "documentsReviewed": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "document_name": {"type": "string"},
                    "document_type": {"type": "string"},
                    "status": {"type": "string"},
                },
                "required": ["document_name", "document_type", "status"]
            }
        },
        "recommendation": {
            "type": "object",
            "properties": {
                "decision": {"type": "string"},
                "rationale": {"type": "string"},
                "conditions": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["decision", "rationale", "conditions"]
        },
        "disclaimer": {
            "type": "string"
        },
        "plainTextNarrative": {
            "type": "string"
        },
    },
    "required": [
        "meta", "executiveSummary", "facilityRequest", "borrowerCompanyOverview",
        "applicantsAndGuarantors", "financialOverview", "strengths", "risksAndMitigants",
        "queries", "conditionsPrecedent", "suggestedCovenants", "documentsReviewed",
        "recommendation", "disclaimer", "plainTextNarrative"
    ]
}


class UnderwriterReportService:
    """Service for generating underwriter reports using OpenAI."""
    
    SYSTEM_PROMPT = """You are a senior UK commercial property finance underwriter writing a lender-ready underwriter's report for a business finance submission. You must:
- Use only the data provided in the input JSON. Never invent, guess, assume, or infer facts not present.
- If a field is missing, write "Not provided" and add a corresponding item to the "queries" section.
- Be professional, concise, and lender-facing. Use UK finance terminology.
- Do not include protected characteristics, medical information, or irrelevant personal speculation.
- Do not output raw bank account numbers, full dates of birth, or full residential addresses.
- Flag risks and inconsistencies neutrally and suggest mitigants or queries.
- Output valid JSON only. No markdown, no commentary.
- Do not provide legal advice. Conditions and covenants must be described as suggested and subject to lender counsel."""
    
    USER_PROMPT_TEMPLATE = """Generate an Underwriter's Report in strict JSON that conforms exactly to the schema provided.

Rules:
- Output JSON only.
- No extra keys, no missing keys.
- Unknown values: null (numeric/date) or "Not provided" (text).
- Currency: GBP numbers only, no symbols.
- Dates: ISO 8601.

Input data:
{REPORT_INPUT_JSON}

Now generate the report."""
    
    def __init__(self):
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not configured")
        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4"  # or "gpt-4-turbo-preview" for latest
    
    def generate_report(self, application: Application, created_by=None) -> UnderwriterReport:
        """Generate an underwriter report for an application."""
        # Get next version number
        latest = UnderwriterReport.objects.filter(
            application=application,
            lender=application.lender
        ).order_by('-version').first()
        next_version = (latest.version + 1) if latest else 1
        
        # Create report record with generating status
        report = UnderwriterReport.objects.create(
            application=application,
            lender=application.lender,
            version=next_version,
            status='generating',
            created_by=created_by,
        )
        
        try:
            # Build input data
            builder = ReportInputBuilder(application)
            input_data = builder.build()
            
            # Store input snapshot
            report.input_data_snapshot = input_data
            report.save()
            
            # Build prompts
            user_prompt = self.USER_PROMPT_TEMPLATE.format(
                REPORT_INPUT_JSON=json.dumps(input_data, indent=2)
            )
            
            # Call OpenAI with low temperature for deterministic output
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                response_format={"type": "json_object"},  # Force JSON output
            )
            
            # Parse response
            content = response.choices[0].message.content
            report_json = json.loads(content)
            
            # Validate against schema (basic check)
            if not self._validate_schema(report_json):
                # Retry with corrective prompt
                return self._retry_generation(application, report, input_data, created_by)
            
            # Extract plain text narrative
            plain_text = report_json.get('plainTextNarrative', '')
            
            # Update report
            report.report_json = report_json
            report.plain_text_narrative = plain_text
            report.status = 'ready'
            report.save()
            
            return report
            
        except json.JSONDecodeError as e:
            report.status = 'failed'
            report.generation_error = f"Invalid JSON response: {str(e)}"
            report.save()
            raise ValueError(f"Failed to parse JSON response: {str(e)}")
        except Exception as e:
            report.status = 'failed'
            report.generation_error = str(e)
            report.save()
            raise
    
    def _retry_generation(self, application: Application, report: UnderwriterReport, input_data: Dict, created_by) -> UnderwriterReport:
        """Retry generation with corrective prompt."""
        corrective_prompt = """Your output failed schema validation. Output JSON only and conform exactly to the schema. Ensure all required fields are present and no extra fields are included.

Input data:
{REPORT_INPUT_JSON}

Now generate the report again, ensuring strict schema compliance.""".format(
            REPORT_INPUT_JSON=json.dumps(input_data, indent=2)
        )
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": corrective_prompt}
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            
            content = response.choices[0].message.content
            report_json = json.loads(content)
            
            plain_text = report_json.get('plainTextNarrative', '')
            
            report.report_json = report_json
            report.plain_text_narrative = plain_text
            report.status = 'ready'
            report.save()
            
            return report
        except Exception as e:
            report.status = 'failed'
            report.generation_error = f"Retry failed: {str(e)}"
            report.save()
            raise
    
    def _validate_schema(self, data: Dict[str, Any]) -> bool:
        """Basic schema validation (check required top-level keys)."""
        required_keys = REPORT_SCHEMA.get('required', [])
        return all(key in data for key in required_keys)

        thread.start()
        
        return report