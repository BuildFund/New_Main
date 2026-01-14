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
    DealDecision, AuditEvent, LawFirm
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
        
        # Create admin party if needed (optional - only if ADMIN_USER_ID is configured)
        admin_user_id = getattr(settings, 'ADMIN_USER_ID', None)
        if admin_user_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                admin_user = User.objects.get(id=admin_user_id)
                DealParty.objects.create(
                    deal=deal,
                    user=admin_user,
                    party_type='admin',
                    appointment_status='active',
                    access_granted_at=timezone.now(),
                )
            except User.DoesNotExist:
                pass
        
        # Initialize stages from templates (non-critical - continue even if this fails)
        try:
            stage_templates = get_all_stage_templates(facility_type)
            
            for template in stage_templates:
                try:
                    stage = DealStage.objects.create(
                        deal=deal,
                        stage_number=template['stage_number'],
                        name=template['name'],
                        description=template.get('description', ''),
                        entry_criteria=template.get('entry_criteria', []),
                        exit_criteria=template.get('exit_criteria', []),
                        sla_target_days=template.get('sla_target_days'),
                        required_tasks=template.get('required_tasks', []),
                        optional_tasks=template.get('optional_tasks', []),
                        status='not_started',
                    )
                    
                    # Create required tasks for this stage
                    for task_template in template.get('required_tasks', []):
                        try:
                            DealTask.objects.create(
                                deal=deal,
                                stage=stage,
                                title=task_template.get('title', 'Untitled Task'),
                                description=task_template.get('description', ''),
                                owner_party_type=task_template.get('owner_party_type', 'lender'),
                                status='pending',
                            )
                        except Exception as task_error:
                            import logging
                            logger = logging.getLogger(__name__)
                            logger.warning(f"Failed to create task for stage {stage.stage_number}: {task_error}", exc_info=True)
                            # Continue with other tasks
                            continue
                except Exception as stage_error:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"Failed to create stage {template.get('stage_number', 'unknown')}: {stage_error}", exc_info=True)
                    # Continue with other stages
                    continue
            
            # Set current stage to Stage 1
            first_stage = deal.stages.filter(stage_number=1).first()
            if first_stage:
                deal.current_stage = first_stage
                first_stage.status = 'in_progress'
                first_stage.entered_at = timezone.now()
                first_stage.save()
                deal.save()
        except Exception as stages_error:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to initialize stages for deal {deal.deal_id} (non-critical): {stages_error}", exc_info=True)
            # Continue - deal is still valid without stages
        
        # Create general message thread (non-critical)
        try:
            general_thread = DealMessageThread.objects.create(
                deal=deal,
                thread_type='general',
                subject=f'General Discussion - {deal.deal_id}',
            )
            general_thread.visible_to_parties.add(borrower_party, lender_party)
        except Exception as thread_error:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to create message thread for deal {deal.deal_id} (non-critical): {thread_error}", exc_info=True)
            # Continue - deal is still valid without message thread
        
        # Create audit event (non-critical)
        try:
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
        except Exception as audit_error:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to create audit event for deal {deal.deal_id} (non-critical): {audit_error}", exc_info=True)
            # Continue - deal is still valid without audit event
        
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
        
        # 5. Outstanding requisitions (weight: 5 points)
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
