"""Services for Deal Progression module."""
from __future__ import annotations

import random
import string
from typing import Dict, Any, Optional
from django.utils import timezone
from django.db import transaction
from django.conf import settings

from .models import (
    Deal, DealParty, DealStage, DealTask, DealCP, DealRequisition,
    Drawdown, DealMessageThread, DealMessage, DealDocumentLink,
    DealDecision, AuditEvent, LawFirm, ProviderDeliverable, DealProviderSelection
)
from .workflow_templates import get_all_stage_templates
from applications.models import Application


def generate_deal_id() -> str:
    """Generate unique deal ID (e.g., DEAL-001)."""
    # Simple implementation - in production, use sequence or UUID
    random_suffix = ''.join(random.choices(string.digits, k=3))
    return f"DEAL-{random_suffix}"


class DealService:
    """Service for creating and managing deals."""
    
    @staticmethod
    @transaction.atomic
    def create_deal_from_application(application: Application) -> Deal:
        """Create a deal when application is accepted."""
        # Check if deal already exists
        if hasattr(application, 'deal'):
            return application.deal
        
        # Generate deal ID
        deal_id = generate_deal_id()
        while Deal.objects.filter(deal_id=deal_id).exists():
            deal_id = generate_deal_id()
        
        # Extract facility type from application
        facility_type_map = {
            'development_finance': 'development',
            'senior_debt': 'development',
            'commercial_mortgage': 'term',
            'mortgage': 'term',
        }
        facility_type = facility_type_map.get(
            application.product.funding_type if application.product else 'bridge',
            'bridge'
        )
        
        # Create commercial terms snapshot
        commercial_terms = {
            'loan_amount': float(application.proposed_loan_amount),
            'interest_rate': float(application.proposed_interest_rate) if application.proposed_interest_rate else None,
            'term_months': application.proposed_term_months,
            'ltv_ratio': float(application.proposed_ltv_ratio) if application.proposed_ltv_ratio else None,
            'product_name': application.product.name if application.product else '',
            'product_type': application.product.funding_type if application.product else '',
        }
        
        # Create deal
        deal = Deal.objects.create(
            application=application,
            deal_id=deal_id,
            lender=application.lender,
            borrower_company=application.project.borrower,
            facility_type=facility_type,
            jurisdiction='UK',
            status='active',
            commercial_terms=commercial_terms,
            accepted_at=timezone.now(),
        )
        
        # Create initial parties (Borrower and Lender)
        borrower_party = DealParty.objects.create(
            deal=deal,
            borrower_profile=application.project.borrower,
            party_type='borrower',
            appointment_status='active',
            access_granted_at=timezone.now(),
        )
        
        lender_party = DealParty.objects.create(
            deal=deal,
            lender_profile=application.lender,
            party_type='lender',
            appointment_status='active',
            access_granted_at=timezone.now(),
        )
        
        # Create admin party if needed
        if settings.ADMIN_USER_ID:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                admin_user = User.objects.get(id=settings.ADMIN_USER_ID)
                DealParty.objects.create(
                    deal=deal,
                    user=admin_user,
                    party_type='admin',
                    appointment_status='active',
                    access_granted_at=timezone.now(),
                )
            except User.DoesNotExist:
                pass
        
        # Auto-invite borrower's solicitor if they have one in their profile
        borrower_profile = application.project.borrower
        if borrower_profile and (borrower_profile.solicitor_firm_name or borrower_profile.solicitor_contact_email):
            from consultants.models import ConsultantProfile
            from django.contrib.auth import get_user_model
            User = get_user_model()
            
            # Check if solicitor is already a user in the system
            solicitor_user = None
            if borrower_profile.solicitor_user:
                solicitor_user = borrower_profile.solicitor_user
            elif borrower_profile.solicitor_contact_email:
                # Try to find user by email
                try:
                    solicitor_user = User.objects.get(email=borrower_profile.solicitor_contact_email)
                    # Check if they have a ConsultantProfile
                    if not hasattr(solicitor_user, 'consultantprofile'):
                        solicitor_user = None
                except User.DoesNotExist:
                    pass
            
            if solicitor_user and hasattr(solicitor_user, 'consultantprofile'):
                # Solicitor is already in system - invite them directly
                consultant_profile = solicitor_user.consultantprofile
                DealParty.objects.create(
                    deal=deal,
                    consultant_profile=consultant_profile,
                    party_type='solicitor',
                    acting_for_party='borrower',
                    appointment_status='invited',
                    invited_at=timezone.now(),
                )
            else:
                # Solicitor not in system - create a placeholder or send invitation
                # For now, we'll create a DealParty with the solicitor info stored
                # The lender can later invite them or they can register
                # TODO: Send invitation email to solicitor to join the system
                pass
        
        # Initialize stages from templates
        stage_templates = get_all_stage_templates(facility_type)
        
        for template in stage_templates:
            stage = DealStage.objects.create(
                deal=deal,
                stage_number=template['stage_number'],
                name=template['name'],
                description=template['description'],
                entry_criteria=template.get('entry_criteria', []),
                exit_criteria=template.get('exit_criteria', []),
                sla_target_days=template.get('sla_target_days'),
                required_tasks=template.get('required_tasks', []),
                optional_tasks=template.get('optional_tasks', []),
                status='not_started',
            )
            
            # Create required tasks for this stage
            for task_template in template.get('required_tasks', []):
                DealTask.objects.create(
                    deal=deal,
                    stage=stage,
                    title=task_template['title'],
                    description=task_template.get('description', ''),
                    owner_party_type=task_template.get('owner_party_type', 'lender'),
                    status='pending',
                )
        
        # Set current stage to Stage 1
        first_stage = deal.stages.filter(stage_number=1).first()
        if first_stage:
            deal.current_stage = first_stage
            first_stage.status = 'in_progress'
            first_stage.entered_at = timezone.now()
            first_stage.save()
            deal.save()
        
        # Create general message thread
        general_thread = DealMessageThread.objects.create(
            deal=deal,
            thread_type='general',
            subject=f'General Discussion - {deal.deal_id}',
        )
        general_thread.visible_to_parties.add(borrower_party, lender_party)
        
        # Create audit event
        AuditEvent.objects.create(
            deal=deal,
            event_type='deal_created',
            actor_user=None,  # System-generated
            metadata={
                'application_id': application.id,
                'facility_type': facility_type,
                'loan_amount': float(application.proposed_loan_amount),
            },
        )
        
        return deal
    
    @staticmethod
    def calculate_completion_readiness_score(deal: Deal) -> Dict[str, Any]:
        """Calculate completion readiness score (0-100)."""
        score = 0
        breakdown = []
        max_score = 100
        
        # 1. Mandatory CPs satisfied (highest weight: 40 points)
        mandatory_cps = deal.conditions_precedent.filter(is_mandatory=True)
        total_mandatory = mandatory_cps.count()
        satisfied_mandatory = mandatory_cps.filter(status='satisfied').count()
        
        if total_mandatory > 0:
            cp_score = (satisfied_mandatory / total_mandatory) * 40
            score += cp_score
            if cp_score < 40:
                breakdown.append({
                    'category': 'Mandatory CPs',
                    'current': satisfied_mandatory,
                    'required': total_mandatory,
                    'weight': 40,
                })
        else:
            # No mandatory CPs yet (stage 6 not reached)
            breakdown.append({
                'category': 'Mandatory CPs',
                'current': 0,
                'required': 0,
                'weight': 40,
                'note': 'No mandatory CPs defined yet',
            })
        
        # 2. Critical path tasks complete (weight: 30 points)
        critical_tasks = deal.tasks.filter(priority='critical')
        total_critical = critical_tasks.count()
        completed_critical = critical_tasks.filter(status='completed').count()
        
        if total_critical > 0:
            task_score = (completed_critical / total_critical) * 30
            score += task_score
            if task_score < 30:
                breakdown.append({
                    'category': 'Critical Path Tasks',
                    'current': completed_critical,
                    'required': total_critical,
                    'weight': 30,
                })
        else:
            # No critical tasks defined yet
            breakdown.append({
                'category': 'Critical Path Tasks',
                'current': 0,
                'required': 0,
                'weight': 30,
                'note': 'No critical tasks defined yet',
            })
        
        # 3. Legal execution completeness (weight: 15 points)
        legal_stage = deal.stages.filter(name__icontains='legals').first()
        if legal_stage:
            legal_tasks = deal.tasks.filter(stage=legal_stage)
            total_legal = legal_tasks.count()
            completed_legal = legal_tasks.filter(status='completed').count()
            
            if total_legal > 0:
                legal_score = (completed_legal / total_legal) * 15
                score += legal_score
                if legal_score < 15:
                    breakdown.append({
                        'category': 'Legal Execution',
                        'current': completed_legal,
                        'required': total_legal,
                        'weight': 15,
                    })
        
        # 4. KYC minimum clearance (weight: 10 points)
        kyc_stage = deal.stages.filter(name__icontains='KYC').first()
        if kyc_stage and kyc_stage.status == 'completed':
            score += 10
        elif kyc_stage:
            breakdown.append({
                'category': 'KYC Clearance',
                'current': 0,
                'required': 1,
                'weight': 10,
            })
        
        # 5. Provider deliverables (weight: 20 points)
        # Check for required provider deliverables based on deal type and selected providers
        provider_deliverable_score = 0
        provider_deliverable_max = 20
        
        # Check if valuer is selected and if final valuation report is approved
        valuer_selected = DealProviderSelection.objects.filter(
            deal=deal,
            role_type='valuer'
        ).exists()
        
        if valuer_selected:
            valuation_final = ProviderDeliverable.objects.filter(
                deal=deal,
                role_type='valuer',
                deliverable_type='valuation_report',
                status='approved'
            ).exists()
            if valuation_final:
                provider_deliverable_score += 8  # Valuation report weight: 8 points
            else:
                breakdown.append({
                    'category': 'Valuation Report',
                    'current': 0,
                    'required': 1,
                    'weight': 8,
                    'note': 'Final valuation report must be approved'
                })
        else:
            # No valuer selected - check if deal requires valuation
            # For now, assume all deals require valuation unless explicitly not required
            breakdown.append({
                'category': 'Valuation Report',
                'current': 0,
                'required': 0,
                'weight': 8,
                'note': 'No valuer selected'
            })
        
        # Check if IMS is selected (development finance only) and if initial report is approved
        if deal.facility_type == 'development':
            ims_selected = DealProviderSelection.objects.filter(
                deal=deal,
                role_type='monitoring_surveyor'
            ).exists()
            
            if ims_selected:
                ims_initial = ProviderDeliverable.objects.filter(
                    deal=deal,
                    role_type='monitoring_surveyor',
                    deliverable_type='ims_initial_report',
                    status='approved'
                ).exists()
                if ims_initial:
                    provider_deliverable_score += 7  # IMS initial report weight: 7 points
                else:
                    breakdown.append({
                        'category': 'IMS Initial Report',
                        'current': 0,
                        'required': 1,
                        'weight': 7,
                        'note': 'IMS initial report must be approved'
                    })
            else:
                breakdown.append({
                    'category': 'IMS Initial Report',
                    'current': 0,
                    'required': 0,
                    'weight': 7,
                    'note': 'No IMS selected'
                })
        
        # Check if legal CPs are satisfied (solicitor workspace)
        solicitor_selected = DealProviderSelection.objects.filter(
            deal=deal,
            role_type='solicitor',
            acting_for_party='lender'
        ).exists()
        
        if solicitor_selected:
            # Check if all mandatory CPs are satisfied (this is already checked above, but we can verify solicitor has marked them)
            # For now, we'll rely on the CP satisfaction check above
            # If we want to add a specific "solicitor confirmed CPs satisfied" deliverable, we can add it here
            pass
        
        score += provider_deliverable_score
        
        # 6. Outstanding requisitions (weight: 5 points)
        open_requisitions = deal.requisitions.filter(status__in=['open', 'responded'])
        if open_requisitions.count() == 0:
            score += 5
        else:
            breakdown.append({
                'category': 'Outstanding Requisitions',
                'current': open_requisitions.count(),
                'required': 0,
                'weight': 5,
            })
        
        # Round score
        score = round(score)
        
        return {
            'score': score,
            'max_score': max_score,
            'breakdown': breakdown,
            'calculated_at': timezone.now().isoformat(),
        }
    
    @staticmethod
    def update_completion_readiness(deal: Deal):
        """Update completion readiness score on deal."""
        readiness_data = DealService.calculate_completion_readiness_score(deal)
        deal.completion_readiness_score = readiness_data['score']
        deal.completion_readiness_breakdown = readiness_data
        deal.save(update_fields=['completion_readiness_score', 'completion_readiness_breakdown', 'updated_at'])
    
    @staticmethod
    def check_completion_readiness(deal: Deal) -> Dict[str, Any]:
        """
        Check if deal is ready to complete by verifying all required provider deliverables.
        Returns dict with 'ready' boolean and 'blockers' list.
        """
        blockers = []
        
        # Check if valuer is selected and final valuation report is approved
        valuer_selected = DealProviderSelection.objects.filter(
            deal=deal,
            role_type='valuer'
        ).exists()
        
        if valuer_selected:
            valuation_final = ProviderDeliverable.objects.filter(
                deal=deal,
                role_type='valuer',
                deliverable_type='valuation_report',
                status='approved'
            ).exists()
            if not valuation_final:
                blockers.append('Final valuation report must be approved')
        
        # Check if IMS is selected (development finance only) and initial report is approved
        if deal.facility_type == 'development':
            ims_selected = DealProviderSelection.objects.filter(
                deal=deal,
                role_type='monitoring_surveyor'
            ).exists()
            
            if ims_selected:
                ims_initial = ProviderDeliverable.objects.filter(
                    deal=deal,
                    role_type='monitoring_surveyor',
                    deliverable_type='ims_initial_report',
                    status='approved'
                ).exists()
                if not ims_initial:
                    blockers.append('IMS initial report must be approved')
        
        # Check if all mandatory CPs are satisfied
        mandatory_cps = deal.conditions_precedent.filter(is_mandatory=True)
        if mandatory_cps.count() > 0:
            satisfied_cps = mandatory_cps.filter(status__in=['satisfied', 'approved']).count()
            if satisfied_cps < mandatory_cps.count():
                blockers.append(f'All mandatory CPs must be satisfied ({satisfied_cps}/{mandatory_cps.count()})')
        
        # Check if solicitor has confirmed legal readiness (if solicitor selected)
        solicitor_selected = DealProviderSelection.objects.filter(
            deal=deal,
            role_type='solicitor',
            acting_for_party='lender'
        ).exists()
        
        if solicitor_selected:
            # Check if there are any open requisitions that block completion
            open_requisitions = deal.requisitions.filter(status__in=['open', 'responded'])
            if open_requisitions.count() > 0:
                blockers.append(f'All requisitions must be closed ({open_requisitions.count()} open)')
        
        return {
            'ready': len(blockers) == 0,
            'blockers': blockers,
            'checked_at': timezone.now().isoformat(),
        }


class WorkflowEngine:
    """Workflow engine for managing deal progression."""
    
    @staticmethod
    def check_stage_entry_criteria(deal: Deal, stage: DealStage) -> tuple[bool, list[str]]:
        """Check if entry criteria are met for a stage."""
        unmet_criteria = []
        
        for criterion in stage.entry_criteria:
            if not WorkflowEngine._evaluate_criterion(deal, criterion):
                unmet_criteria.append(criterion)
        
        return len(unmet_criteria) == 0, unmet_criteria
    
    @staticmethod
    def check_stage_exit_criteria(deal: Deal, stage: DealStage) -> tuple[bool, list[str]]:
        """Check if exit criteria are met for a stage."""
        unmet_criteria = []
        
        for criterion in stage.exit_criteria:
            if not WorkflowEngine._evaluate_criterion(deal, criterion):
                unmet_criteria.append(criterion)
        
        return len(unmet_criteria) == 0, unmet_criteria
    
    @staticmethod
    def _evaluate_criterion(deal: Deal, criterion: str) -> bool:
        """Evaluate a single criterion."""
        # Simple implementation - can be extended with more complex logic
        criterion_lower = criterion.lower()
        
        # Check for stage completions
        if 'stage' in criterion_lower or 'completed' in criterion_lower:
            if 'kick-off' in criterion_lower:
                kickoff_stage = deal.stages.filter(stage_number=1).first()
                return kickoff_stage and kickoff_stage.status == 'completed'
            elif 'kyc' in criterion_lower or 'aml' in criterion_lower:
                kyc_stage = deal.stages.filter(stage_number=2).first()
                return kyc_stage and kyc_stage.status == 'completed'
            elif 'due diligence' in criterion_lower:
                dd_stage = deal.stages.filter(stage_number=3).first()
                return dd_stage and dd_stage.status == 'completed'
            elif 'third-party' in criterion_lower or 'reports' in criterion_lower:
                reports_stage = deal.stages.filter(stage_number=4).first()
                return reports_stage and reports_stage.status == 'completed'
            elif 'offer' in criterion_lower or 'facility letter' in criterion_lower:
                offer_stage = deal.stages.filter(stage_number=5).first()
                return offer_stage and offer_stage.status == 'completed'
            elif 'mandatory cps' in criterion_lower or 'legals' in criterion_lower:
                legal_stage = deal.stages.filter(stage_number=6).first()
                if not legal_stage:
                    return False
                # Check if all mandatory CPs are satisfied
                mandatory_cps = deal.conditions_precedent.filter(is_mandatory=True)
                return mandatory_cps.count() > 0 and mandatory_cps.filter(status__in=['satisfied', 'approved']).count() == mandatory_cps.count()
        
        # Check for party appointments
        if 'solicitor appointed' in criterion_lower:
            return DealParty.objects.filter(
                deal=deal,
                party_type='solicitor',
                acting_for_party='lender',
                appointment_status='active',
                is_active_lender_solicitor=True
            ).exists()
        elif 'valuer appointed' in criterion_lower:
            return DealParty.objects.filter(
                deal=deal,
                party_type='valuer',
                appointment_status='active'
            ).exists()
        elif 'ims' in criterion_lower or 'monitoring surveyor' in criterion_lower:
            return DealParty.objects.filter(
                deal=deal,
                party_type='monitoring_surveyor',
                appointment_status='active'
            ).exists()
        
        # Check for provider deliverables
        if 'valuation' in criterion_lower and ('final' in criterion_lower or 'issued' in criterion_lower or 'approved' in criterion_lower):
            # Check if final valuation report is approved
            return ProviderDeliverable.objects.filter(
                deal=deal,
                role_type='valuer',
                deliverable_type='valuation_report',
                status='approved'
            ).exists()
        
        elif 'ims' in criterion_lower and ('initial' in criterion_lower or 'report' in criterion_lower) and ('issued' in criterion_lower or 'approved' in criterion_lower):
            # Check if IMS initial report is approved (for development finance)
            if deal.facility_type == 'development':
                return ProviderDeliverable.objects.filter(
                    deal=deal,
                    role_type='monitoring_surveyor',
                    deliverable_type='ims_initial_report',
                    status='approved'
                ).exists()
            else:
                # Not required for non-development deals
                return True
        
        elif 'legal' in criterion_lower and ('cps' in criterion_lower or 'cp' in criterion_lower) and ('satisfied' in criterion_lower or 'ready' in criterion_lower):
            # Check if all mandatory CPs are satisfied (legal workspace)
            mandatory_cps = deal.conditions_precedent.filter(is_mandatory=True)
            if mandatory_cps.count() == 0:
                # No mandatory CPs defined yet
                return False
            return mandatory_cps.filter(status__in=['satisfied', 'approved']).count() == mandatory_cps.count()
        
        elif 'drawdown' in criterion_lower and 'certificate' in criterion_lower:
            # Check if drawdown has IMS certificate (for specific drawdowns)
            # This is checked per drawdown, not at deal level
            # For now, return True if IMS is selected (certificate check happens at drawdown level)
            return DealProviderSelection.objects.filter(
                deal=deal,
                role_type='monitoring_surveyor'
            ).exists()
        
        # Default: assume criterion is met if no specific check matches
        return True
    
    @staticmethod
    @transaction.atomic
    def advance_to_next_stage(deal: Deal) -> Optional[DealStage]:
        """Advance deal to next stage if exit criteria are met."""
        if not deal.current_stage:
            # Start with stage 1
            first_stage = deal.stages.filter(stage_number=1).first()
            if first_stage:
                deal.current_stage = first_stage
                first_stage.status = 'in_progress'
                first_stage.entered_at = timezone.now()
                first_stage.save()
                deal.save()
                return first_stage
            return None
        
        # Check if current stage exit criteria are met
        can_exit, unmet = WorkflowEngine.check_stage_exit_criteria(deal, deal.current_stage)
        if not can_exit:
            return None
        
        # Complete current stage
        deal.current_stage.status = 'completed'
        deal.current_stage.completed_at = timezone.now()
        deal.current_stage.save()
        
        # Find next stage
        next_stage_number = deal.current_stage.stage_number + 1
        next_stage = deal.stages.filter(stage_number=next_stage_number).first()
        
        if next_stage:
            # Check entry criteria
            can_enter, unmet = WorkflowEngine.check_stage_entry_criteria(deal, next_stage)
            if can_enter:
                deal.current_stage = next_stage
                next_stage.status = 'in_progress'
                next_stage.entered_at = timezone.now()
                next_stage.save()
                deal.save()
                
                # Create audit event
                AuditEvent.objects.create(
                    deal=deal,
                    event_type='stage_entered',
                    metadata={
                        'stage_number': next_stage.stage_number,
                        'stage_name': next_stage.name,
                    },
                )
                
                return next_stage
        
        return None
