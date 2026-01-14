"""AI-powered borrower analysis report generation."""
from __future__ import annotations

from typing import Dict, Any
from .models import Application
from projects.models import Project
from borrowers.models import BorrowerProfile


class BorrowerAnalysisReport:
    """Generate comprehensive borrower analysis report."""
    
    @staticmethod
    def generate_report(application: Application) -> Dict[str, Any]:
        """
        Generate a comprehensive analysis report for a borrower and their project.
        
        Args:
            application: The application to analyze
            
        Returns:
            Dictionary containing analysis report sections
        """
        project = application.project
        borrower = project.borrower
        
        report = {
            "borrower_summary": BorrowerAnalysisReport._analyze_borrower(borrower),
            "project_viability": BorrowerAnalysisReport._analyze_project(project),
            "financial_strength": BorrowerAnalysisReport._analyze_financials(borrower, project),
            "risk_assessment": BorrowerAnalysisReport._assess_risks(borrower, project, application),
            "recommendation": BorrowerAnalysisReport._generate_recommendation(borrower, project, application),
        }
        
        return report
    
    @staticmethod
    def _analyze_borrower(borrower: BorrowerProfile) -> Dict[str, Any]:
        """Analyze borrower profile."""
        return {
            "company_name": borrower.company_name or "N/A",
            "registration_number": borrower.registration_number or "N/A",
            "experience_level": "Experienced" if borrower.experience_description else "New",
            "has_verification": hasattr(borrower, "company_verification") and borrower.company_verification.status == "verified",
            "contact_info_complete": bool(borrower.phone_number and borrower.address_1),
        }
    
    @staticmethod
    def _analyze_project(project: Project) -> Dict[str, Any]:
        """Analyze project viability."""
        ltv_ratio = project.calculate_ltv_ratio()
        
        # Calculate project metrics
        has_financials = bool(
            project.purchase_price or project.current_market_value or project.gross_development_value
        )
        
        gdv_ltv = None
        if project.gross_development_value and project.loan_amount_required:
            gdv_ltv = (float(project.loan_amount_required) / float(project.gross_development_value)) * 100
        
        return {
            "property_type": project.get_property_type_display(),
            "development_extent": project.get_development_extent_display(),
            "has_planning": project.planning_permission,
            "ltv_ratio": round(ltv_ratio, 2) if ltv_ratio else None,
            "gdv_ltv": round(gdv_ltv, 2) if gdv_ltv else None,
            "financial_info_complete": has_financials,
            "loan_amount": float(project.loan_amount_required),
            "term_months": project.term_required_months,
        }
    
    @staticmethod
    def _analyze_financials(borrower: BorrowerProfile, project: Project) -> Dict[str, Any]:
        """Analyze financial strength."""
        income_details = borrower.income_details or {}
        expenses_details = borrower.expenses_details or {}
        
        # Extract financial metrics
        annual_income = income_details.get("annual_income", 0) if isinstance(income_details, dict) else 0
        monthly_expenses = expenses_details.get("monthly_expenses", 0) if isinstance(expenses_details, dict) else 0
        
        # Calculate affordability
        monthly_income = annual_income / 12 if annual_income else 0
        affordability_ratio = (monthly_expenses / monthly_income * 100) if monthly_income > 0 else 0
        
        # Project funding
        funds_provided = float(project.funds_provided_by_applicant or 0)
        loan_amount = float(project.loan_amount_required)
        equity_contribution = (funds_provided / (funds_provided + loan_amount) * 100) if (funds_provided + loan_amount) > 0 else 0
        
        return {
            "annual_income": annual_income,
            "monthly_expenses": monthly_expenses,
            "affordability_ratio": round(affordability_ratio, 2),
            "equity_contribution_percent": round(equity_contribution, 2),
            "funds_provided": funds_provided,
            "has_income_details": bool(income_details),
            "has_expense_details": bool(expenses_details),
        }
    
    @staticmethod
    def _assess_risks(borrower: BorrowerProfile, project: Project, application: Application) -> Dict[str, Any]:
        """Assess overall risk factors."""
        risks = []
        risk_score = 0
        
        # LTV risk
        ltv_ratio = project.calculate_ltv_ratio()
        if ltv_ratio:
            if ltv_ratio > 80:
                risks.append("High LTV ratio (>80%)")
                risk_score += 3
            elif ltv_ratio > 70:
                risks.append("Moderate LTV ratio (70-80%)")
                risk_score += 2
            else:
                risks.append("Low LTV ratio (<70%)")
                risk_score += 1
        
        # Planning permission
        if not project.planning_permission:
            risks.append("No planning permission")
            risk_score += 2
        
        # Financial information
        if not borrower.income_details:
            risks.append("Missing income details")
            risk_score += 1
        
        # Verification
        if not (hasattr(borrower, "company_verification") and borrower.company_verification.status == "verified"):
            risks.append("Company not verified")
            risk_score += 2
        
        # Existing mortgage
        if project.existing_mortgage:
            risks.append("Existing mortgage on property")
            risk_score += 1
        
        # Determine risk level
        if risk_score >= 7:
            risk_level = "High"
        elif risk_score >= 4:
            risk_level = "Medium"
        else:
            risk_level = "Low"
        
        return {
            "risk_level": risk_level,
            "risk_score": risk_score,
            "identified_risks": risks,
            "total_risks": len(risks),
        }
    
    @staticmethod
    def _generate_recommendation(borrower: BorrowerProfile, project: Project, application: Application) -> Dict[str, Any]:
        """Generate recommendation based on analysis."""
        ltv_ratio = project.calculate_ltv_ratio()
        risk_assessment = BorrowerAnalysisReport._assess_risks(borrower, project, application)
        
        recommendation = "Approve"
        confidence = "High"
        conditions = []
        
        if risk_assessment["risk_level"] == "High":
            recommendation = "Review Required"
            confidence = "Low"
            conditions.append("Additional due diligence recommended")
        elif risk_assessment["risk_level"] == "Medium":
            recommendation = "Approve with Conditions"
            confidence = "Medium"
            conditions.append("Standard terms apply")
        
        if ltv_ratio and ltv_ratio > 75:
            conditions.append("Higher interest rate may be required due to LTV")
        
        if not project.planning_permission:
            conditions.append("Planning permission should be obtained before drawdown")
        
        return {
            "recommendation": recommendation,
            "confidence": confidence,
            "conditions": conditions,
            "summary": f"Based on the analysis, this application is recommended for {recommendation.lower()} with {confidence.lower()} confidence.",
        }
