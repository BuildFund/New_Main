"""
Industry-standard provider workflow templates for Valuers, Monitoring Surveyors, and Solicitors.
These define the stages and tasks that providers go through on a deal.
"""
from typing import Dict, List, Any


# Provider stage templates by role type
PROVIDER_STAGE_TEMPLATES: Dict[str, List[Dict[str, Any]]] = {
    'valuer': [
        {
            'stage_name': 'instructed',
            'display_name': 'Instructed',
            'description': 'Valuer has been instructed and received instruction pack',
            'sla_days': 1,
            'entry_criteria': [],
            'exit_criteria': ['Instruction pack received and acknowledged'],
            'tasks': [
                {
                    'title': 'Acknowledge instruction',
                    'description': 'Confirm receipt of instruction pack and terms',
                    'owner_party_type': 'valuer',
                    'priority': 'high',
                    'sla_hours': 24,
                },
                {
                    'title': 'Review instruction pack',
                    'description': 'Review all provided documentation and requirements',
                    'owner_party_type': 'valuer',
                    'priority': 'high',
                    'sla_hours': 48,
                },
            ],
        },
        {
            'stage_name': 'inspection_scheduled',
            'display_name': 'Inspection Scheduled',
            'description': 'Site inspection has been scheduled',
            'sla_days': 3,
            'entry_criteria': ['Instruction acknowledged'],
            'exit_criteria': ['Inspection date confirmed'],
            'tasks': [
                {
                    'title': 'Schedule site inspection',
                    'description': 'Arrange inspection date with borrower/agent',
                    'owner_party_type': 'valuer',
                    'priority': 'high',
                    'sla_hours': 72,
                },
                {
                    'title': 'Confirm inspection details',
                    'description': 'Confirm date, time, access arrangements, and contact details',
                    'owner_party_type': 'valuer',
                    'priority': 'medium',
                    'sla_hours': 24,
                },
            ],
        },
        {
            'stage_name': 'inspection_completed',
            'display_name': 'Inspection Completed',
            'description': 'Site inspection has been conducted',
            'sla_days': 1,
            'entry_criteria': ['Inspection scheduled'],
            'exit_criteria': ['Inspection conducted and notes recorded'],
            'tasks': [
                {
                    'title': 'Conduct site inspection',
                    'description': 'Carry out physical inspection of property',
                    'owner_party_type': 'valuer',
                    'priority': 'critical',
                    'sla_hours': None,  # Date-based
                },
                {
                    'title': 'Record inspection findings',
                    'description': 'Document all observations, measurements, and photographs',
                    'owner_party_type': 'valuer',
                    'priority': 'high',
                    'sla_hours': 24,
                },
            ],
        },
        {
            'stage_name': 'draft_report',
            'display_name': 'Draft Report',
            'description': 'Draft valuation report prepared',
            'sla_days': 7,
            'entry_criteria': ['Inspection completed'],
            'exit_criteria': ['Draft report uploaded'],
            'tasks': [
                {
                    'title': 'Prepare draft valuation report',
                    'description': 'Draft report with all required sections and analysis',
                    'owner_party_type': 'valuer',
                    'priority': 'high',
                    'sla_hours': 168,  # 7 days
                },
                {
                    'title': 'Upload draft report',
                    'description': 'Upload draft for lender review',
                    'owner_party_type': 'valuer',
                    'priority': 'high',
                    'sla_hours': 24,
                },
            ],
        },
        {
            'stage_name': 'final_report',
            'display_name': 'Final Report',
            'description': 'Final valuation report submitted',
            'sla_days': 3,
            'entry_criteria': ['Draft report reviewed'],
            'exit_criteria': ['Final report uploaded'],
            'tasks': [
                {
                    'title': 'Incorporate lender feedback',
                    'description': 'Address any queries or amendments requested',
                    'owner_party_type': 'valuer',
                    'priority': 'high',
                    'sla_hours': 48,
                },
                {
                    'title': 'Upload final valuation report',
                    'description': 'Upload final signed report',
                    'owner_party_type': 'valuer',
                    'priority': 'high',
                    'sla_hours': 24,
                },
                {
                    'title': 'Upload reliance letter',
                    'description': 'Provide reliance letter if required',
                    'owner_party_type': 'valuer',
                    'priority': 'medium',
                    'sla_hours': 48,
                    'optional': True,
                },
            ],
        },
        {
            'stage_name': 'accepted',
            'display_name': 'Accepted',
            'description': 'Valuation report accepted by lender',
            'sla_days': 2,
            'entry_criteria': ['Final report uploaded'],
            'exit_criteria': ['Report accepted by lender'],
            'tasks': [
                {
                    'title': 'Lender review and acceptance',
                    'description': 'Lender reviews and accepts final report',
                    'owner_party_type': 'lender',
                    'priority': 'high',
                    'sla_hours': 48,
                },
            ],
        },
    ],
    
    'monitoring_surveyor': [
        {
            'stage_name': 'instructed',
            'display_name': 'Instructed',
            'description': 'Monitoring Surveyor has been instructed',
            'sla_days': 1,
            'entry_criteria': [],
            'exit_criteria': ['Instruction pack received'],
            'tasks': [
                {
                    'title': 'Acknowledge instruction',
                    'description': 'Confirm receipt of instruction and terms',
                    'owner_party_type': 'monitoring_surveyor',
                    'priority': 'high',
                    'sla_hours': 24,
                },
            ],
        },
        {
            'stage_name': 'kickoff_meeting',
            'display_name': 'Kick-off Meeting',
            'description': 'Initial kick-off meeting with borrower and lender',
            'sla_days': 5,
            'entry_criteria': ['Instructed'],
            'exit_criteria': ['Kick-off meeting completed'],
            'tasks': [
                {
                    'title': 'Schedule kick-off meeting',
                    'description': 'Arrange meeting with borrower and lender',
                    'owner_party_type': 'monitoring_surveyor',
                    'priority': 'high',
                    'sla_hours': 72,
                },
                {
                    'title': 'Conduct kick-off meeting',
                    'description': 'Meet with parties to establish monitoring requirements',
                    'owner_party_type': 'monitoring_surveyor',
                    'priority': 'high',
                    'sla_hours': None,  # Date-based
                },
            ],
        },
        {
            'stage_name': 'document_review',
            'display_name': 'Document Review',
            'description': 'Reviewing project documentation and plans',
            'sla_days': 7,
            'entry_criteria': ['Kick-off meeting completed'],
            'exit_criteria': ['Document review completed'],
            'tasks': [
                {
                    'title': 'Receive document pack',
                    'description': 'Obtain all project documentation from lender/borrower',
                    'owner_party_type': 'monitoring_surveyor',
                    'priority': 'high',
                    'sla_hours': 48,
                },
                {
                    'title': 'Review project documentation',
                    'description': 'Review plans, specifications, budget, and programme',
                    'owner_party_type': 'monitoring_surveyor',
                    'priority': 'high',
                    'sla_hours': 120,
                },
            ],
        },
        {
            'stage_name': 'initial_report',
            'display_name': 'Initial Report',
            'description': 'Initial monitoring report prepared',
            'sla_days': 10,
            'entry_criteria': ['Document review completed'],
            'exit_criteria': ['Initial report accepted'],
            'tasks': [
                {
                    'title': 'Prepare draft initial report',
                    'description': 'Draft initial monitoring report with baseline assessment',
                    'owner_party_type': 'monitoring_surveyor',
                    'priority': 'high',
                    'sla_hours': 168,  # 7 days
                },
                {
                    'title': 'Upload draft initial report',
                    'description': 'Upload draft for lender review',
                    'owner_party_type': 'monitoring_surveyor',
                    'priority': 'high',
                    'sla_hours': 24,
                },
                {
                    'title': 'Upload final initial report',
                    'description': 'Upload final signed initial report',
                    'owner_party_type': 'monitoring_surveyor',
                    'priority': 'high',
                    'sla_hours': 48,
                },
                {
                    'title': 'Lender accept initial report',
                    'description': 'Lender reviews and accepts initial report',
                    'owner_party_type': 'lender',
                    'priority': 'high',
                    'sla_hours': 48,
                },
            ],
        },
        {
            'stage_name': 'monitoring_ongoing',
            'display_name': 'Monitoring Ongoing',
            'description': 'Ongoing monitoring of project progress',
            'sla_days': None,  # Ongoing
            'entry_criteria': ['Initial report accepted'],
            'exit_criteria': ['Project completed'],
            'tasks': [
                {
                    'title': 'Conduct site visits',
                    'description': 'Regular site visits as per monitoring schedule',
                    'owner_party_type': 'monitoring_surveyor',
                    'priority': 'high',
                    'sla_hours': None,  # Recurring
                    'recurring': True,
                },
                {
                    'title': 'Review drawdown requests',
                    'description': 'Review and certify drawdown requests',
                    'owner_party_type': 'monitoring_surveyor',
                    'priority': 'high',
                    'sla_hours': 48,
                    'recurring': True,
                },
                {
                    'title': 'Upload monitoring reports',
                    'description': 'Upload periodic monitoring reports',
                    'owner_party_type': 'monitoring_surveyor',
                    'priority': 'medium',
                    'sla_hours': 168,  # Monthly
                    'recurring': True,
                },
            ],
        },
        {
            'stage_name': 'completion',
            'display_name': 'Completion',
            'description': 'Project monitoring completed',
            'sla_days': 14,
            'entry_criteria': ['Project completed'],
            'exit_criteria': ['Final completion report accepted'],
            'tasks': [
                {
                    'title': 'Conduct final inspection',
                    'description': 'Final site inspection to confirm completion',
                    'owner_party_type': 'monitoring_surveyor',
                    'priority': 'high',
                    'sla_hours': 72,
                },
                {
                    'title': 'Upload completion report',
                    'description': 'Upload final completion and sign-off report',
                    'owner_party_type': 'monitoring_surveyor',
                    'priority': 'high',
                    'sla_hours': 168,  # 7 days
                },
            ],
        },
    ],
    
    'solicitor': [
        {
            'stage_name': 'instructed',
            'display_name': 'Instructed',
            'description': 'Solicitor has been instructed',
            'sla_days': 1,
            'entry_criteria': [],
            'exit_criteria': ['Instruction received and acknowledged'],
            'tasks': [
                {
                    'title': 'Acknowledge instruction',
                    'description': 'Confirm receipt of instruction and terms',
                    'owner_party_type': 'solicitor',
                    'priority': 'high',
                    'sla_hours': 24,
                },
            ],
        },
        {
            'stage_name': 'cp_checklist_prepared',
            'display_name': 'CP Checklist Prepared',
            'description': 'Conditions Precedent checklist has been prepared',
            'sla_days': 3,
            'entry_criteria': ['Instructed'],
            'exit_criteria': ['CP checklist issued'],
            'tasks': [
                {
                    'title': 'Prepare CP checklist',
                    'description': 'Create comprehensive Conditions Precedent checklist',
                    'owner_party_type': 'solicitor',
                    'priority': 'high',
                    'sla_hours': 48,
                },
                {
                    'title': 'Issue CP checklist',
                    'description': 'Issue checklist to borrower and lender',
                    'owner_party_type': 'solicitor',
                    'priority': 'high',
                    'sla_hours': 24,
                },
            ],
        },
        {
            'stage_name': 'cps_satisfied',
            'display_name': 'CPs Satisfied',
            'description': 'All mandatory Conditions Precedent satisfied',
            'sla_days': 21,
            'entry_criteria': ['CP checklist issued'],
            'exit_criteria': ['All mandatory CPs satisfied and approved'],
            'tasks': [
                {
                    'title': 'Raise legal requisitions',
                    'description': 'Raise requisitions on title and other matters',
                    'owner_party_type': 'solicitor',
                    'priority': 'high',
                    'sla_hours': 72,
                },
                {
                    'title': 'Review CP evidence',
                    'description': 'Review evidence provided for each CP',
                    'owner_party_type': 'solicitor',
                    'priority': 'high',
                    'sla_hours': None,  # Ongoing
                    'recurring': True,
                },
                {
                    'title': 'Approve satisfied CPs',
                    'description': 'Approve CPs once evidence is satisfactory',
                    'owner_party_type': 'solicitor',
                    'priority': 'high',
                    'sla_hours': 24,
                    'recurring': True,
                },
            ],
        },
        {
            'stage_name': 'legal_docs_prepared',
            'display_name': 'Legal Docs Prepared',
            'description': 'Legal documentation prepared and ready for execution',
            'sla_days': 7,
            'entry_criteria': ['All mandatory CPs satisfied'],
            'exit_criteria': ['Legal documents prepared and circulated'],
            'tasks': [
                {
                    'title': 'Prepare facility agreement',
                    'description': 'Draft facility/loan agreement',
                    'owner_party_type': 'solicitor',
                    'priority': 'high',
                    'sla_hours': 120,
                },
                {
                    'title': 'Prepare security documents',
                    'description': 'Draft charge, debenture, and other security documents',
                    'owner_party_type': 'solicitor',
                    'priority': 'high',
                    'sla_hours': 120,
                },
                {
                    'title': 'Circulate documents for review',
                    'description': 'Send documents to all parties for review',
                    'owner_party_type': 'solicitor',
                    'priority': 'high',
                    'sla_hours': 24,
                },
            ],
        },
        {
            'stage_name': 'completion_ready',
            'display_name': 'Completion Ready',
            'description': 'All documentation ready and completion can proceed',
            'sla_days': 3,
            'entry_criteria': ['Legal documents prepared'],
            'exit_criteria': ['Completion checklist satisfied'],
            'tasks': [
                {
                    'title': 'Finalise completion checklist',
                    'description': 'Confirm all completion requirements are met',
                    'owner_party_type': 'solicitor',
                    'priority': 'high',
                    'sla_hours': 48,
                },
                {
                    'title': 'Verify payment instructions',
                    'description': 'Confirm payment instructions are correct',
                    'owner_party_type': 'solicitor',
                    'priority': 'critical',
                    'sla_hours': 24,
                },
                {
                    'title': 'Mark ready for completion',
                    'description': 'Confirm all requirements met and ready to complete',
                    'owner_party_type': 'solicitor',
                    'priority': 'high',
                    'sla_hours': 24,
                },
            ],
        },
        {
            'stage_name': 'completed',
            'display_name': 'Completed',
            'description': 'Completion has occurred and funds released',
            'sla_days': 1,
            'entry_criteria': ['Completion ready'],
            'exit_criteria': ['Completion confirmed and funds released'],
            'tasks': [
                {
                    'title': 'Receive executed documents',
                    'description': 'Receive all executed facility and security documents',
                    'owner_party_type': 'solicitor',
                    'priority': 'critical',
                    'sla_hours': 24,
                },
                {
                    'title': 'Upload executed documents',
                    'description': 'Upload all executed documents to deal room',
                    'owner_party_type': 'solicitor',
                    'priority': 'high',
                    'sla_hours': 24,
                },
                {
                    'title': 'Confirm completion',
                    'description': 'Confirm completion has occurred',
                    'owner_party_type': 'solicitor',
                    'priority': 'critical',
                    'sla_hours': 24,
                },
            ],
        },
    ],
}


def get_provider_stage_template(role_type: str, stage_name: str) -> Dict[str, Any] | None:
    """Get a specific provider stage template."""
    templates = PROVIDER_STAGE_TEMPLATES.get(role_type, [])
    for template in templates:
        if template['stage_name'] == stage_name:
            return template
    return None


def get_all_provider_stage_templates(role_type: str) -> List[Dict[str, Any]]:
    """Get all stage templates for a provider role type."""
    return PROVIDER_STAGE_TEMPLATES.get(role_type, [])


def get_initial_provider_stage(role_type: str) -> str:
    """Get the initial stage name for a provider role."""
    templates = PROVIDER_STAGE_TEMPLATES.get(role_type, [])
    if templates:
        return templates[0]['stage_name']
    return 'instructed'


def get_next_provider_stage(role_type: str, current_stage: str) -> str | None:
    """Get the next stage name for a provider role."""
    templates = PROVIDER_STAGE_TEMPLATES.get(role_type, [])
    for i, template in enumerate(templates):
        if template['stage_name'] == current_stage and i < len(templates) - 1:
            return templates[i + 1]['stage_name']
    return None
