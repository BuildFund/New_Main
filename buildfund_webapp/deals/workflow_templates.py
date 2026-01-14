"""Stage templates for different facility types."""
from typing import Dict, List, Any


# Stage templates by facility type
STAGE_TEMPLATES: Dict[str, List[Dict[str, Any]]] = {
    'bridge': [
        {
            'stage_number': 1,
            'name': 'Deal Kick-off',
            'description': 'Confirm parties, contacts, comms preferences. Confirm consultant appointments needed.',
            'entry_criteria': [],
            'exit_criteria': [
                'All parties confirmed',
                'Lender solicitor appointed',
                'Valuer appointed',
                'Commercial terms frozen',
            ],
            'sla_target_days': 3,
            'required_tasks': [
                {'title': 'Confirm parties and contacts', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Appoint lender solicitor', 'owner_party_type': 'lender', 'description': 'Lender must appoint their solicitor'},
                {'title': 'Appoint valuer', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Freeze commercial terms', 'owner_party_type': 'lender', 'description': 'Create read-only snapshot of terms'},
            ],
            'optional_tasks': [],
        },
        {
            'stage_number': 2,
            'name': 'Compliance and KYC/AML',
            'description': 'Company and applicant checks completion. Document requests. AML audit pack.',
            'entry_criteria': ['Deal kick-off completed'],
            'exit_criteria': [
                'Minimum KYC requirements met',
                'AML checks completed',
                'All required compliance documents uploaded',
            ],
            'sla_target_days': 7,
            'required_tasks': [
                {'title': 'Complete company checks', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Complete applicant checks', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Upload ID documents', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Upload POA documents', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Upload ownership/control evidence', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Review KYC/AML and create audit pack', 'owner_party_type': 'lender', 'description': ''},
            ],
            'optional_tasks': [],
        },
        {
            'stage_number': 3,
            'name': 'Due Diligence Pack and Information Requests',
            'description': 'Lender issues structured checklist. Borrower uploads evidence.',
            'entry_criteria': ['KYC/AML stage completed'],
            'exit_criteria': [
                'All due diligence items satisfied',
                'Lender review completed',
            ],
            'sla_target_days': 14,
            'required_tasks': [
                {'title': 'Issue due diligence checklist', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Upload requested documents', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Review due diligence pack', 'owner_party_type': 'lender', 'description': ''},
            ],
            'optional_tasks': [],
        },
        {
            'stage_number': 4,
            'name': 'Third-Party Reports',
            'description': 'Valuation workflow: instruct, appointment, inspection, draft, final, accepted.',
            'entry_criteria': ['Due diligence completed'],
            'exit_criteria': [
                'Valuation report accepted',
            ],
            'sla_target_days': 14,
            'required_tasks': [
                {'title': 'Instruct valuer', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Schedule inspection', 'owner_party_type': 'valuer', 'description': ''},
                {'title': 'Conduct inspection', 'owner_party_type': 'valuer', 'description': ''},
                {'title': 'Upload draft valuation report', 'owner_party_type': 'valuer', 'description': ''},
                {'title': 'Review draft valuation', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Upload final valuation report', 'owner_party_type': 'valuer', 'description': ''},
                {'title': 'Accept valuation', 'owner_party_type': 'lender', 'description': ''},
            ],
            'optional_tasks': [
                {'title': 'Upload reliance letter', 'owner_party_type': 'valuer', 'description': ''},
            ],
        },
        {
            'stage_number': 5,
            'name': 'Credit Approval Finalisation and Offer Pack',
            'description': 'Underwriter report attached. Offer/facility letter versions stored and accepted.',
            'entry_criteria': ['Third-party reports completed'],
            'exit_criteria': [
                'Underwriter report attached',
                'Facility letter accepted by borrower',
            ],
            'sla_target_days': 5,
            'required_tasks': [
                {'title': 'Attach underwriter report', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Issue facility letter', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Accept facility letter', 'owner_party_type': 'borrower', 'description': ''},
            ],
            'optional_tasks': [],
        },
        {
            'stage_number': 6,
            'name': 'Legals and Conditions Precedent (CPs)',
            'description': 'Lender solicitor leads this stage. CP checklist engine. Legal requisitions queue.',
            'entry_criteria': ['Offer pack accepted'],
            'exit_criteria': [
                'All mandatory CPs satisfied',
                'Legal documentation prepared',
            ],
            'sla_target_days': 21,
            'required_tasks': [
                {'title': 'Prepare CP checklist', 'owner_party_type': 'solicitor', 'description': 'Lender solicitor creates CP checklist'},
                {'title': 'Satisfy mandatory CPs', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Raise legal requisitions', 'owner_party_type': 'solicitor', 'description': 'Lender solicitor raises requisitions'},
                {'title': 'Respond to requisitions', 'owner_party_type': 'borrower', 'description': 'Borrower or borrower solicitor responds'},
                {'title': 'Approve CPs', 'owner_party_type': 'solicitor', 'description': 'Lender solicitor approves satisfied CPs'},
            ],
            'optional_tasks': [
                {'title': 'Respond to requisitions (borrower solicitor)', 'owner_party_type': 'solicitor', 'description': 'If borrower has solicitor'},
            ],
        },
        {
            'stage_number': 7,
            'name': 'Completion and Initial Drawdown',
            'description': 'Completion coordination led by lender solicitor. Final checklist. Status transitions.',
            'entry_criteria': ['All mandatory CPs satisfied'],
            'exit_criteria': [
                'All mandatory CPs satisfied',
                'Executed documents uploaded',
                'Payment instructions verified',
                'Insurances confirmed (where required)',
                'Deal marked as completed',
                'Funds released',
            ],
            'sla_target_days': 7,
            'required_tasks': [
                {'title': 'Upload executed facility agreement', 'owner_party_type': 'solicitor', 'description': ''},
                {'title': 'Upload executed security documents', 'owner_party_type': 'solicitor', 'description': ''},
                {'title': 'Verify payment instructions', 'owner_party_type': 'lender', 'description': 'Step-up auth required'},
                {'title': 'Confirm insurances', 'owner_party_type': 'borrower', 'description': 'Where required'},
                {'title': 'Mark deal as ready to complete', 'owner_party_type': 'solicitor', 'description': 'Lender solicitor confirms readiness'},
                {'title': 'Confirm completion', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Release funds', 'owner_party_type': 'lender', 'description': ''},
            ],
            'optional_tasks': [
                {'title': 'Upload board minutes/resolutions', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Upload guarantees', 'owner_party_type': 'solicitor', 'description': ''},
            ],
        },
        {
            'stage_number': 9,
            'name': 'Exit and Close-Out',
            'description': 'Exit path: refinance or sale. Redemption statement workflow. Discharge of security. Deal close report.',
            'entry_criteria': ['Facility repaid'],
            'exit_criteria': [
                'Redemption statement issued',
                'Discharge of security completed',
                'Deal archived',
            ],
            'sla_target_days': 14,
            'required_tasks': [
                {'title': 'Issue redemption statement', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Process repayment', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Discharge security', 'owner_party_type': 'solicitor', 'description': ''},
                {'title': 'Generate deal close report', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Archive deal', 'owner_party_type': 'admin', 'description': ''},
            ],
            'optional_tasks': [],
        },
    ],
    
    'development': [
        {
            'stage_number': 1,
            'name': 'Deal Kick-off',
            'description': 'Confirm parties, contacts, comms preferences. Confirm consultant appointments needed.',
            'entry_criteria': [],
            'exit_criteria': [
                'All parties confirmed',
                'Lender solicitor appointed',
                'Valuer appointed',
                'Monitoring Surveyor (IMS) appointed',
                'Commercial terms frozen',
            ],
            'sla_target_days': 3,
            'required_tasks': [
                {'title': 'Confirm parties and contacts', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Appoint lender solicitor', 'owner_party_type': 'lender', 'description': 'Lender must appoint their solicitor'},
                {'title': 'Appoint valuer', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Appoint Monitoring Surveyor (IMS)', 'owner_party_type': 'lender', 'description': 'Required for development finance'},
                {'title': 'Freeze commercial terms', 'owner_party_type': 'lender', 'description': 'Create read-only snapshot of terms'},
            ],
            'optional_tasks': [],
        },
        {
            'stage_number': 2,
            'name': 'Compliance and KYC/AML',
            'description': 'Company and applicant checks completion. Document requests. AML audit pack.',
            'entry_criteria': ['Deal kick-off completed'],
            'exit_criteria': [
                'Minimum KYC requirements met',
                'AML checks completed',
                'All required compliance documents uploaded',
            ],
            'sla_target_days': 7,
            'required_tasks': [
                {'title': 'Complete company checks', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Complete applicant checks', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Upload ID documents', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Upload POA documents', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Upload ownership/control evidence', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Review KYC/AML and create audit pack', 'owner_party_type': 'lender', 'description': ''},
            ],
            'optional_tasks': [],
        },
        {
            'stage_number': 3,
            'name': 'Due Diligence Pack and Information Requests',
            'description': 'Lender issues structured checklist. Borrower uploads evidence.',
            'entry_criteria': ['KYC/AML stage completed'],
            'exit_criteria': [
                'All due diligence items satisfied',
                'Lender review completed',
            ],
            'sla_target_days': 14,
            'required_tasks': [
                {'title': 'Issue due diligence checklist', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Upload requested documents', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Review due diligence pack', 'owner_party_type': 'lender', 'description': ''},
            ],
            'optional_tasks': [],
        },
        {
            'stage_number': 4,
            'name': 'Third-Party Reports',
            'description': 'Valuation workflow and Monitoring Surveyor (IMS) workflow.',
            'entry_criteria': ['Due diligence completed'],
            'exit_criteria': [
                'Valuation report accepted',
                'IMS initial report accepted',
            ],
            'sla_target_days': 14,
            'required_tasks': [
                {'title': 'Instruct valuer', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Schedule valuation inspection', 'owner_party_type': 'valuer', 'description': ''},
                {'title': 'Conduct valuation inspection', 'owner_party_type': 'valuer', 'description': ''},
                {'title': 'Upload draft valuation report', 'owner_party_type': 'valuer', 'description': ''},
                {'title': 'Review draft valuation', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Upload final valuation report', 'owner_party_type': 'valuer', 'description': ''},
                {'title': 'Accept valuation', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Instruct IMS', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'IMS receive document pack', 'owner_party_type': 'monitoring_surveyor', 'description': ''},
                {'title': 'IMS kick-off meeting', 'owner_party_type': 'monitoring_surveyor', 'description': ''},
                {'title': 'Upload IMS draft report', 'owner_party_type': 'monitoring_surveyor', 'description': ''},
                {'title': 'Upload IMS final report', 'owner_party_type': 'monitoring_surveyor', 'description': ''},
                {'title': 'Accept IMS initial report', 'owner_party_type': 'lender', 'description': ''},
            ],
            'optional_tasks': [
                {'title': 'Upload reliance letter (valuer)', 'owner_party_type': 'valuer', 'description': ''},
            ],
        },
        {
            'stage_number': 5,
            'name': 'Credit Approval Finalisation and Offer Pack',
            'description': 'Underwriter report attached. Offer/facility letter versions stored and accepted.',
            'entry_criteria': ['Third-party reports completed'],
            'exit_criteria': [
                'Underwriter report attached',
                'Facility letter accepted by borrower',
            ],
            'sla_target_days': 5,
            'required_tasks': [
                {'title': 'Attach underwriter report', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Issue facility letter', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Accept facility letter', 'owner_party_type': 'borrower', 'description': ''},
            ],
            'optional_tasks': [],
        },
        {
            'stage_number': 6,
            'name': 'Legals and Conditions Precedent (CPs)',
            'description': 'Lender solicitor leads this stage. CP checklist engine. Legal requisitions queue.',
            'entry_criteria': ['Offer pack accepted'],
            'exit_criteria': [
                'All mandatory CPs satisfied',
                'Legal documentation prepared',
            ],
            'sla_target_days': 21,
            'required_tasks': [
                {'title': 'Prepare CP checklist', 'owner_party_type': 'solicitor', 'description': 'Lender solicitor creates CP checklist'},
                {'title': 'Satisfy mandatory CPs', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Raise legal requisitions', 'owner_party_type': 'solicitor', 'description': 'Lender solicitor raises requisitions'},
                {'title': 'Respond to requisitions', 'owner_party_type': 'borrower', 'description': 'Borrower or borrower solicitor responds'},
                {'title': 'Approve CPs', 'owner_party_type': 'solicitor', 'description': 'Lender solicitor approves satisfied CPs'},
            ],
            'optional_tasks': [
                {'title': 'Respond to requisitions (borrower solicitor)', 'owner_party_type': 'solicitor', 'description': 'If borrower has solicitor'},
            ],
        },
        {
            'stage_number': 7,
            'name': 'Completion and Initial Drawdown',
            'description': 'Completion coordination led by lender solicitor. Final checklist. Status transitions.',
            'entry_criteria': ['All mandatory CPs satisfied'],
            'exit_criteria': [
                'All mandatory CPs satisfied',
                'Executed documents uploaded',
                'Payment instructions verified',
                'Insurances confirmed (where required)',
                'Deal marked as completed',
                'Initial drawdown released',
            ],
            'sla_target_days': 7,
            'required_tasks': [
                {'title': 'Upload executed facility agreement', 'owner_party_type': 'solicitor', 'description': ''},
                {'title': 'Upload executed security documents', 'owner_party_type': 'solicitor', 'description': ''},
                {'title': 'Verify payment instructions', 'owner_party_type': 'lender', 'description': 'Step-up auth required'},
                {'title': 'Confirm insurances', 'owner_party_type': 'borrower', 'description': 'Where required'},
                {'title': 'Mark deal as ready to complete', 'owner_party_type': 'solicitor', 'description': 'Lender solicitor confirms readiness'},
                {'title': 'Confirm completion', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Request initial drawdown', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Approve initial drawdown', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Release initial drawdown', 'owner_party_type': 'lender', 'description': ''},
            ],
            'optional_tasks': [
                {'title': 'Upload board minutes/resolutions', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Upload guarantees', 'owner_party_type': 'solicitor', 'description': ''},
            ],
        },
        {
            'stage_number': 8,
            'name': 'Drawdowns and Monitoring',
            'description': 'Ongoing drawdown workflow: borrower requests -> IMS visit/report/certificate -> lender review/approval -> mark paid.',
            'entry_criteria': ['Initial drawdown released'],
            'exit_criteria': [
                'All drawdowns completed',
            ],
            'sla_target_days': None,  # Ongoing stage
            'required_tasks': [
                # These tasks are created dynamically per drawdown
            ],
            'optional_tasks': [],
        },
        {
            'stage_number': 9,
            'name': 'Exit and Close-Out',
            'description': 'Exit path: refinance or sale. Redemption statement workflow. Discharge of security. Deal close report.',
            'entry_criteria': ['Facility repaid'],
            'exit_criteria': [
                'Redemption statement issued',
                'Discharge of security completed',
                'Deal archived',
            ],
            'sla_target_days': 14,
            'required_tasks': [
                {'title': 'Issue redemption statement', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Process repayment', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Discharge security', 'owner_party_type': 'solicitor', 'description': ''},
                {'title': 'Generate deal close report', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Archive deal', 'owner_party_type': 'admin', 'description': ''},
            ],
            'optional_tasks': [],
        },
    ],
    
    'term': [
        # Similar to bridge but without drawdowns stage
        # Stages 1-7 and 9 same as bridge
        # (I'll duplicate bridge template for now, can be refined)
        {
            'stage_number': 1,
            'name': 'Deal Kick-off',
            'description': 'Confirm parties, contacts, comms preferences. Confirm consultant appointments needed.',
            'entry_criteria': [],
            'exit_criteria': [
                'All parties confirmed',
                'Lender solicitor appointed',
                'Valuer appointed',
                'Commercial terms frozen',
            ],
            'sla_target_days': 3,
            'required_tasks': [
                {'title': 'Confirm parties and contacts', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Appoint lender solicitor', 'owner_party_type': 'lender', 'description': 'Lender must appoint their solicitor'},
                {'title': 'Appoint valuer', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Freeze commercial terms', 'owner_party_type': 'lender', 'description': 'Create read-only snapshot of terms'},
            ],
            'optional_tasks': [],
        },
        {
            'stage_number': 2,
            'name': 'Compliance and KYC/AML',
            'description': 'Company and applicant checks completion. Document requests. AML audit pack.',
            'entry_criteria': ['Deal kick-off completed'],
            'exit_criteria': [
                'Minimum KYC requirements met',
                'AML checks completed',
                'All required compliance documents uploaded',
            ],
            'sla_target_days': 7,
            'required_tasks': [
                {'title': 'Complete company checks', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Complete applicant checks', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Upload ID documents', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Upload POA documents', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Upload ownership/control evidence', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Review KYC/AML and create audit pack', 'owner_party_type': 'lender', 'description': ''},
            ],
            'optional_tasks': [],
        },
        {
            'stage_number': 3,
            'name': 'Due Diligence Pack and Information Requests',
            'description': 'Lender issues structured checklist. Borrower uploads evidence.',
            'entry_criteria': ['KYC/AML stage completed'],
            'exit_criteria': [
                'All due diligence items satisfied',
                'Lender review completed',
            ],
            'sla_target_days': 14,
            'required_tasks': [
                {'title': 'Issue due diligence checklist', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Upload requested documents', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Review due diligence pack', 'owner_party_type': 'lender', 'description': ''},
            ],
            'optional_tasks': [],
        },
        {
            'stage_number': 4,
            'name': 'Third-Party Reports',
            'description': 'Valuation workflow: instruct, appointment, inspection, draft, final, accepted.',
            'entry_criteria': ['Due diligence completed'],
            'exit_criteria': [
                'Valuation report accepted',
            ],
            'sla_target_days': 14,
            'required_tasks': [
                {'title': 'Instruct valuer', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Schedule inspection', 'owner_party_type': 'valuer', 'description': ''},
                {'title': 'Conduct inspection', 'owner_party_type': 'valuer', 'description': ''},
                {'title': 'Upload draft valuation report', 'owner_party_type': 'valuer', 'description': ''},
                {'title': 'Review draft valuation', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Upload final valuation report', 'owner_party_type': 'valuer', 'description': ''},
                {'title': 'Accept valuation', 'owner_party_type': 'lender', 'description': ''},
            ],
            'optional_tasks': [
                {'title': 'Upload reliance letter', 'owner_party_type': 'valuer', 'description': ''},
            ],
        },
        {
            'stage_number': 5,
            'name': 'Credit Approval Finalisation and Offer Pack',
            'description': 'Underwriter report attached. Offer/facility letter versions stored and accepted.',
            'entry_criteria': ['Third-party reports completed'],
            'exit_criteria': [
                'Underwriter report attached',
                'Facility letter accepted by borrower',
            ],
            'sla_target_days': 5,
            'required_tasks': [
                {'title': 'Attach underwriter report', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Issue facility letter', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Accept facility letter', 'owner_party_type': 'borrower', 'description': ''},
            ],
            'optional_tasks': [],
        },
        {
            'stage_number': 6,
            'name': 'Legals and Conditions Precedent (CPs)',
            'description': 'Lender solicitor leads this stage. CP checklist engine. Legal requisitions queue.',
            'entry_criteria': ['Offer pack accepted'],
            'exit_criteria': [
                'All mandatory CPs satisfied',
                'Legal documentation prepared',
            ],
            'sla_target_days': 21,
            'required_tasks': [
                {'title': 'Prepare CP checklist', 'owner_party_type': 'solicitor', 'description': 'Lender solicitor creates CP checklist'},
                {'title': 'Satisfy mandatory CPs', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Raise legal requisitions', 'owner_party_type': 'solicitor', 'description': 'Lender solicitor raises requisitions'},
                {'title': 'Respond to requisitions', 'owner_party_type': 'borrower', 'description': 'Borrower or borrower solicitor responds'},
                {'title': 'Approve CPs', 'owner_party_type': 'solicitor', 'description': 'Lender solicitor approves satisfied CPs'},
            ],
            'optional_tasks': [
                {'title': 'Respond to requisitions (borrower solicitor)', 'owner_party_type': 'solicitor', 'description': 'If borrower has solicitor'},
            ],
        },
        {
            'stage_number': 7,
            'name': 'Completion and Initial Drawdown',
            'description': 'Completion coordination led by lender solicitor. Final checklist. Status transitions.',
            'entry_criteria': ['All mandatory CPs satisfied'],
            'exit_criteria': [
                'All mandatory CPs satisfied',
                'Executed documents uploaded',
                'Payment instructions verified',
                'Insurances confirmed (where required)',
                'Deal marked as completed',
                'Funds released',
            ],
            'sla_target_days': 7,
            'required_tasks': [
                {'title': 'Upload executed facility agreement', 'owner_party_type': 'solicitor', 'description': ''},
                {'title': 'Upload executed security documents', 'owner_party_type': 'solicitor', 'description': ''},
                {'title': 'Verify payment instructions', 'owner_party_type': 'lender', 'description': 'Step-up auth required'},
                {'title': 'Confirm insurances', 'owner_party_type': 'borrower', 'description': 'Where required'},
                {'title': 'Mark deal as ready to complete', 'owner_party_type': 'solicitor', 'description': 'Lender solicitor confirms readiness'},
                {'title': 'Confirm completion', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Release funds', 'owner_party_type': 'lender', 'description': ''},
            ],
            'optional_tasks': [
                {'title': 'Upload board minutes/resolutions', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Upload guarantees', 'owner_party_type': 'solicitor', 'description': ''},
            ],
        },
        {
            'stage_number': 9,
            'name': 'Exit and Close-Out',
            'description': 'Exit path: refinance or sale. Redemption statement workflow. Discharge of security. Deal close report.',
            'entry_criteria': ['Facility repaid'],
            'exit_criteria': [
                'Redemption statement issued',
                'Discharge of security completed',
                'Deal archived',
            ],
            'sla_target_days': 14,
            'required_tasks': [
                {'title': 'Issue redemption statement', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Process repayment', 'owner_party_type': 'borrower', 'description': ''},
                {'title': 'Discharge security', 'owner_party_type': 'solicitor', 'description': ''},
                {'title': 'Generate deal close report', 'owner_party_type': 'lender', 'description': ''},
                {'title': 'Archive deal', 'owner_party_type': 'admin', 'description': ''},
            ],
            'optional_tasks': [],
        },
    ],
}


def get_stage_template(facility_type: str, stage_number: int) -> Dict[str, Any] | None:
    """Get a specific stage template."""
    templates = STAGE_TEMPLATES.get(facility_type, [])
    for template in templates:
        if template['stage_number'] == stage_number:
            return template
    return None


def get_all_stage_templates(facility_type: str) -> List[Dict[str, Any]]:
    """Get all stage templates for a facility type."""
    return STAGE_TEMPLATES.get(facility_type, [])
