"""Models for Deal Progression module."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.db.models import Q, F


class Deal(models.Model):
    """Represents a loan deal after application acceptance."""
    
    FACILITY_TYPE_CHOICES = [
        ('bridge', 'Bridge Loan'),
        ('term', 'Term Loan'),
        ('development', 'Development Finance'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('on_hold', 'On Hold'),
    ]
    
    application = models.OneToOneField(
        "applications.Application",
        related_name="deal",
        on_delete=models.CASCADE,
        help_text="The application this deal was created from"
    )
    deal_id = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        help_text="Unique deal identifier (e.g., DEAL-001)"
    )
    lender = models.ForeignKey(
        "lenders.LenderProfile",
        related_name="deals",
        on_delete=models.CASCADE
    )
    borrower_company = models.ForeignKey(
        "borrowers.BorrowerProfile",
        related_name="deals",
        on_delete=models.CASCADE
    )
    
    # Deal details
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    facility_type = models.CharField(max_length=20, choices=FACILITY_TYPE_CHOICES)
    jurisdiction = models.CharField(max_length=50, default='UK')
    
    # Stage tracking
    current_stage = models.ForeignKey(
        "deals.DealStage",
        related_name="active_deals",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Current stage of the deal"
    )
    
    # Dates
    accepted_at = models.DateTimeField(auto_now_add=True)
    target_completion_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Commercial terms snapshot (read-only after kickoff)
    commercial_terms = models.JSONField(
        default=dict,
        help_text="Snapshot of commercial terms at acceptance"
    )
    
    # Completion readiness
    completion_readiness_score = models.IntegerField(
        default=0,
        help_text="Completion readiness score (0-100)"
    )
    completion_readiness_breakdown = models.JSONField(
        default=dict,
        blank=True,
        help_text="Breakdown of what is preventing 100% readiness"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-accepted_at']
        indexes = [
            models.Index(fields=['lender', '-accepted_at']),
            models.Index(fields=['borrower_company', '-accepted_at']),
            models.Index(fields=['status', '-accepted_at']),
        ]
    
    def __str__(self) -> str:
        return f"Deal {self.deal_id or self.id} ({self.facility_type})"
    
    def calculate_readiness_score(self):
        """Calculate completion readiness score."""
        # This will be implemented in the service
        pass


class DealParty(models.Model):
    """Represents a party (borrower, lender, consultant) involved in a deal."""
    
    PARTY_TYPE_CHOICES = [
        ('borrower', 'Borrower'),
        ('lender', 'Lender'),
        ('admin', 'Admin'),
        ('valuer', 'Valuer'),
        ('monitoring_surveyor', 'Monitoring Surveyor'),
        ('solicitor', 'Solicitor'),
    ]
    
    ACTING_FOR_CHOICES = [
        ('lender', 'Lender'),
        ('borrower', 'Borrower'),
    ]
    
    deal = models.ForeignKey(
        Deal,
        related_name="parties",
        on_delete=models.CASCADE
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="User account for this party (null for borrower/lender as they use profile users)"
    )
    borrower_profile = models.ForeignKey(
        "borrowers.BorrowerProfile",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Borrower profile (if party is borrower)"
    )
    lender_profile = models.ForeignKey(
        "lenders.LenderProfile",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Lender profile (if party is lender)"
    )
    consultant_profile = models.ForeignKey(
        "consultants.ConsultantProfile",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Consultant profile (if party is consultant)"
    )
    
    party_type = models.CharField(max_length=30, choices=PARTY_TYPE_CHOICES)
    acting_for_party = models.CharField(
        max_length=20,
        choices=ACTING_FOR_CHOICES,
        null=True,
        blank=True,
        help_text="Required for consultants: who they are acting for"
    )
    
    # Consultant-specific fields
    firm_name = models.CharField(max_length=200, blank=True)
    sra_number = models.CharField(max_length=50, blank=True, help_text="SRA number for solicitors")
    rics_number = models.CharField(max_length=50, blank=True, help_text="RICS number for surveyors")
    
    # Solicitor-specific
    is_active_lender_solicitor = models.BooleanField(
        default=False,
        help_text="Only ONE lender solicitor can be active per deal"
    )
    
    # Access control
    appointment_status = models.CharField(
        max_length=20,
        choices=[
            ('invited', 'Invited'),
            ('pending_confirmation', 'Pending Confirmation'),
            ('confirmed', 'Confirmed'),
            ('active', 'Active'),
            ('removed', 'Removed'),
        ],
        default='invited'
    )
    access_granted_at = models.DateTimeField(null=True, blank=True)
    removed_at = models.DateTimeField(null=True, blank=True)
    removal_reason = models.TextField(blank=True)
    
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="invited_deal_parties",
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    invited_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = [
            ('deal', 'user', 'party_type'),  # Prevent duplicate party entries
        ]
        indexes = [
            models.Index(fields=['deal', 'party_type']),
            models.Index(fields=['deal', 'is_active_lender_solicitor']),
        ]
    
    def __str__(self) -> str:
        return f"{self.party_type} on {self.deal}"


class DealStage(models.Model):
    """Represents a stage in the deal workflow."""
    
    deal = models.ForeignKey(
        Deal,
        related_name="stages",
        on_delete=models.CASCADE
    )
    stage_number = models.PositiveIntegerField()
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    
    # Entry/exit criteria
    entry_criteria = models.JSONField(
        default=list,
        blank=True,
        help_text="List of conditions that must be met to enter this stage"
    )
    exit_criteria = models.JSONField(
        default=list,
        blank=True,
        help_text="List of conditions that must be met to exit this stage"
    )
    
    # SLA
    sla_target_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Target number of days to complete this stage"
    )
    
    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=[
            ('not_started', 'Not Started'),
            ('in_progress', 'In Progress'),
            ('completed', 'Completed'),
            ('blocked', 'Blocked'),
        ],
        default='not_started'
    )
    entered_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Required and optional tasks (stored as JSON for flexibility)
    required_tasks = models.JSONField(default=list, blank=True)
    optional_tasks = models.JSONField(default=list, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['deal', 'stage_number']
        unique_together = ['deal', 'stage_number']
    
    def __str__(self) -> str:
        return f"Stage {self.stage_number}: {self.name} ({self.deal})"


class DealTask(models.Model):
    """Represents a task within a deal stage."""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('blocked', 'Blocked'),
        ('cancelled', 'Cancelled'),
    ]
    
    PRIORITY_CHOICES = [
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]
    
    deal = models.ForeignKey(
        Deal,
        related_name="tasks",
        on_delete=models.CASCADE
    )
    stage = models.ForeignKey(
        DealStage,
        related_name="tasks",
        on_delete=models.CASCADE
    )
    
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    # Ownership and assignment
    owner_party_type = models.CharField(
        max_length=30,
        help_text="Party type that owns this task (e.g., 'lender', 'solicitor')"
    )
    assignee_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Specific user assigned to this task"
    )
    assignee_party = models.ForeignKey(
        DealParty,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Party assigned to this task"
    )
    
    # Timing
    due_date = models.DateTimeField(null=True, blank=True)
    sla_hours = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="SLA in hours for this task"
    )
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    
    # Dependencies
    dependencies = models.ManyToManyField(
        'self',
        symmetrical=False,
        blank=True,
        help_text="Tasks that must be completed before this task can start"
    )
    
    # Required documents
    required_docs = models.JSONField(
        default=list,
        blank=True,
        help_text="List of document types/categories required for this task"
    )
    
    # Blockers
    blockers = models.JSONField(
        default=list,
        blank=True,
        help_text="List of blockers preventing task completion"
    )
    
    # Completion
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="completed_tasks",
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['deal', 'stage', 'due_date', 'priority']
        indexes = [
            models.Index(fields=['deal', 'status']),
            models.Index(fields=['assignee_user', 'status']),
            models.Index(fields=['due_date']),
        ]
    
    def __str__(self) -> str:
        return f"{self.title} ({self.deal})"


class DealCP(models.Model):
    """Represents a Condition Precedent (CP) in the deal."""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('satisfied', 'Satisfied'),
        ('rejected', 'Rejected'),
        ('waived', 'Waived'),
    ]
    
    deal = models.ForeignKey(
        Deal,
        related_name="conditions_precedent",
        on_delete=models.CASCADE
    )
    stage = models.ForeignKey(
        DealStage,
        related_name="cps",
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    
    cp_number = models.CharField(max_length=20, help_text="CP reference number (e.g., CP1, CP2)")
    title = models.CharField(max_length=200)
    description = models.TextField()
    
    # Ownership and status
    is_mandatory = models.BooleanField(default=True)
    owner_party_type = models.CharField(
        max_length=30,
        help_text="Party type responsible for satisfying this CP"
    )
    owner_party = models.ForeignKey(
        DealParty,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_cps"
    )
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Evidence and approval
    evidence_documents = models.ManyToManyField(
        "documents.Document",
        blank=True,
        related_name="cp_evidence"
    )
    satisfied_at = models.DateTimeField(null=True, blank=True)
    satisfied_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="satisfied_cps"
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="approved_cps",
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    
    # Rejection/waiver
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="rejected_cps",
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    rejection_reason = models.TextField(blank=True)
    
    due_date = models.DateField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['deal', 'cp_number']
        unique_together = ['deal', 'cp_number']
    
    def __str__(self) -> str:
        return f"{self.cp_number}: {self.title} ({self.deal})"


class DealRequisition(models.Model):
    """Represents a legal requisition (question from lender solicitor to borrower)."""
    
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('responded', 'Responded'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('closed', 'Closed'),
    ]
    
    deal = models.ForeignKey(
        Deal,
        related_name="requisitions",
        on_delete=models.CASCADE
    )
    
    requisition_number = models.CharField(max_length=20, help_text="Requisition reference number")
    subject = models.CharField(max_length=200)
    question = models.TextField()
    
    # Parties
    raised_by = models.ForeignKey(
        DealParty,
        related_name="raised_requisitions",
        on_delete=models.CASCADE,
        help_text="Lender solicitor who raised this requisition"
    )
    assigned_to = models.ForeignKey(
        DealParty,
        related_name="assigned_requisitions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Borrower or borrower solicitor to respond"
    )
    
    # Status and response
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    response = models.TextField(blank=True)
    response_documents = models.ManyToManyField(
        "documents.Document",
        blank=True,
        related_name="requisition_responses"
    )
    
    responded_at = models.DateTimeField(null=True, blank=True)
    responded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="responded_requisitions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="approved_requisitions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    due_date = models.DateField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['deal', '-created_at']
        unique_together = ['deal', 'requisition_number']
    
    def __str__(self) -> str:
        return f"Req {self.requisition_number}: {self.subject} ({self.deal})"


class Drawdown(models.Model):
    """Represents a drawdown request for development finance."""
    
    STATUS_CHOICES = [
        ('requested', 'Requested'),
        ('ims_inspection_required', 'IMS Inspection Required'),
        ('ims_certified', 'IMS Certified'),
        ('lender_review', 'Lender Review'),
        ('approved', 'Approved'),
        ('paid', 'Paid'),
        ('rejected', 'Rejected'),
    ]
    
    deal = models.ForeignKey(
        Deal,
        related_name="drawdowns",
        on_delete=models.CASCADE
    )
    
    sequence_number = models.PositiveIntegerField(help_text="Drawdown sequence (1, 2, 3...)")
    
    requested_amount = models.DecimalField(max_digits=15, decimal_places=2)
    purpose = models.TextField(help_text="Purpose of this drawdown")
    milestone = models.CharField(max_length=200, blank=True, help_text="Build milestone this drawdown relates to")
    
    # IMS workflow
    ims_inspection_required = models.BooleanField(default=True)
    ims_inspection_date = models.DateField(null=True, blank=True)
    ims_certificate_document = models.ForeignKey(
        "documents.Document",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ims_certificates"
    )
    ims_report_document = models.ForeignKey(
        "documents.Document",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ims_drawdown_reports"
    )
    
    # Approval workflow
    lender_approval_status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='requested')
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_drawdowns"
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    
    # Payment
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)
    
    # Retention and contingencies
    retention_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Retention amount held back"
    )
    contingencies = models.JSONField(
        default=list,
        blank=True,
        help_text="List of contingencies or conditions"
    )
    
    requested_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['deal', 'sequence_number']
        unique_together = ['deal', 'sequence_number']
    
    def __str__(self) -> str:
        return f"Drawdown #{self.sequence_number} - £{self.requested_amount} ({self.deal})"


class DealMessageThread(models.Model):
    """Represents a message thread within a deal."""
    
    THREAD_TYPE_CHOICES = [
        ('general', 'General (Borrower-Lender)'),
        ('legal', 'Legal (Lender + Lender Solicitor + Borrower Solicitor)'),
        ('valuation', 'Valuation (Lender + Valuer)'),
        ('ims', 'IMS (Lender + Monitoring Surveyor)'),
    ]
    
    deal = models.ForeignKey(
        Deal,
        related_name="message_threads",
        on_delete=models.CASCADE
    )
    thread_type = models.CharField(max_length=20, choices=THREAD_TYPE_CHOICES, default='general')
    subject = models.CharField(max_length=200, blank=True)
    
    # Visibility - who can see this thread
    visible_to_parties = models.ManyToManyField(
        DealParty,
        related_name="accessible_threads"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['deal', '-last_message_at']
    
    def __str__(self) -> str:
        return f"{self.thread_type} thread - {self.deal}"


class DealMessage(models.Model):
    """Represents a message within a deal thread."""
    
    thread = models.ForeignKey(
        DealMessageThread,
        related_name="messages",
        on_delete=models.CASCADE
    )
    sender = models.ForeignKey(
        DealParty,
        related_name="sent_messages",
        on_delete=models.CASCADE
    )
    sender_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    message = models.TextField()
    attachments = models.ManyToManyField(
        "documents.Document",
        blank=True,
        related_name="message_attachments"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['thread', 'created_at']
    
    def __str__(self) -> str:
        return f"Message from {self.sender} in {self.thread}"


class DealDocumentLink(models.Model):
    """Links documents to deals with visibility controls."""
    
    VISIBILITY_CHOICES = [
        ('borrower_only', 'Borrower Only'),
        ('lender_only', 'Lender Only'),
        ('shared', 'Shared (Borrower + Lender)'),
        ('consultant_scoped', 'Consultant Scoped'),
        ('legal_only', 'Legal Only (Solicitors)'),
    ]
    
    deal = models.ForeignKey(
        Deal,
        related_name="document_links",
        on_delete=models.CASCADE
    )
    document = models.ForeignKey(
        "documents.Document",
        on_delete=models.CASCADE
    )
    
    document_category = models.CharField(
        max_length=50,
        choices=[
            ('compliance', 'Compliance (KYC/AML)'),
            ('legal', 'Legal'),
            ('reports', 'Reports'),
            ('financial', 'Financial'),
            ('drawdowns', 'Drawdowns'),
        ]
    )
    visibility = models.CharField(max_length=30, choices=VISIBILITY_CHOICES, default='shared')
    
    # Consultant scoping (if visibility is consultant_scoped)
    visible_to_consultants = models.ManyToManyField(
        DealParty,
        blank=True,
        related_name="scoped_documents"
    )
    
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['deal', 'document']
        ordering = ['deal', '-uploaded_at']
    
    def __str__(self) -> str:
        return f"{self.document.file_name} - {self.deal}"


class DealDecision(models.Model):
    """Logs key decisions in the deal."""
    
    DECISION_TYPE_CHOICES = [
        ('credit_signoff', 'Credit Sign-off'),
        ('cp_approval', 'CP Approval'),
        ('cp_rejection', 'CP Rejection'),
        ('drawdown_approval', 'Drawdown Approval'),
        ('completion_confirmation', 'Completion Confirmation'),
        ('stage_transition', 'Stage Transition'),
    ]
    
    deal = models.ForeignKey(
        Deal,
        related_name="decisions",
        on_delete=models.CASCADE
    )
    decision_type = models.CharField(max_length=30, choices=DECISION_TYPE_CHOICES)
    
    made_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    made_by_party = models.ForeignKey(
        DealParty,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    decision_text = models.TextField()
    related_object_type = models.CharField(max_length=50, blank=True, help_text="e.g., 'DealCP', 'Drawdown'")
    related_object_id = models.PositiveIntegerField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['deal', '-created_at']
    
    def __str__(self) -> str:
        return f"{self.decision_type} - {self.deal}"


class AuditEvent(models.Model):
    """Immutable audit log for all deal actions."""
    
    EVENT_TYPE_CHOICES = [
        ('deal_created', 'Deal Created'),
        ('stage_entered', 'Stage Entered'),
        ('stage_completed', 'Stage Completed'),
        ('task_created', 'Task Created'),
        ('task_assigned', 'Task Assigned'),
        ('task_completed', 'Task Completed'),
        ('cp_satisfied', 'CP Satisfied'),
        ('cp_approved', 'CP Approved'),
        ('cp_rejected', 'CP Rejected'),
        ('requisition_raised', 'Requisition Raised'),
        ('requisition_responded', 'Requisition Responded'),
        ('document_uploaded', 'Document Uploaded'),
        ('document_viewed', 'Document Viewed'),
        ('document_downloaded', 'Document Downloaded'),
        ('party_invited', 'Party Invited'),
        ('party_confirmed', 'Party Confirmed'),
        ('solicitor_appointed', 'Solicitor Appointed'),
        ('solicitor_replaced', 'Solicitor Replaced'),
        ('drawdown_requested', 'Drawdown Requested'),
        ('drawdown_certified', 'Drawdown Certified'),
        ('drawdown_approved', 'Drawdown Approved'),
        ('drawdown_paid', 'Drawdown Paid'),
        ('completion_confirmed', 'Completion Confirmed'),
        ('kyc_reviewed', 'KYC Reviewed'),
        ('aml_check_completed', 'AML Check Completed'),
    ]
    
    deal = models.ForeignKey(
        Deal,
        related_name="audit_events",
        on_delete=models.CASCADE
    )
    event_type = models.CharField(max_length=50, choices=EVENT_TYPE_CHOICES)
    
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    actor_party = models.ForeignKey(
        DealParty,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    timestamp = models.DateTimeField(auto_now_add=True)
    
    object_type = models.CharField(max_length=50, blank=True, help_text="Type of object affected (e.g., 'DealTask', 'DealCP')")
    object_id = models.PositiveIntegerField(null=True, blank=True)
    
    diff_summary = models.JSONField(
        default=dict,
        blank=True,
        help_text="Summary of changes made (before/after)"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional event metadata"
    )
    
    class Meta:
        ordering = ['deal', '-timestamp']
        indexes = [
            models.Index(fields=['deal', '-timestamp']),
            models.Index(fields=['actor_user', '-timestamp']),
            models.Index(fields=['event_type', '-timestamp']),
        ]
    
    def __str__(self) -> str:
        return f"{self.event_type} - {self.deal} at {self.timestamp}"


# Law Firm Panel Models

class LawFirm(models.Model):
    """Represents a law firm that can be on lender panels."""
    
    firm_name = models.CharField(max_length=200, unique=True)
    sra_number = models.CharField(max_length=50, blank=True, help_text="SRA registration number")
    
    # Contact information
    primary_contact_name = models.CharField(max_length=100, blank=True)
    primary_contact_email = models.EmailField(blank=True)
    primary_contact_phone = models.CharField(max_length=30, blank=True)
    
    # Coverage and specialisms
    coverage_regions = models.JSONField(
        default=list,
        blank=True,
        help_text="List of regions/areas this firm covers"
    )
    specialisms = models.JSONField(
        default=list,
        blank=True,
        help_text="List of specialisms (e.g., 'commercial property', 'development finance')"
    )
    
    # Compliance
    compliance_validated = models.BooleanField(default=False)
    compliance_validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="validated_law_firms"
    )
    compliance_validated_at = models.DateTimeField(null=True, blank=True)
    
    # Performance metrics (aggregated)
    average_acknowledgment_hours = models.FloatField(null=True, blank=True)
    average_requisition_response_hours = models.FloatField(null=True, blank=True)
    average_cp_satisfaction_hours = models.FloatField(null=True, blank=True)
    average_completion_days = models.FloatField(null=True, blank=True)
    
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self) -> str:
        return self.firm_name


class LawFirmPanelMembership(models.Model):
    """Represents a law firm's membership on a lender's panel."""
    
    lender = models.ForeignKey(
        "lenders.LenderProfile",
        related_name="panel_memberships",
        on_delete=models.CASCADE
    )
    law_firm = models.ForeignKey(
        LawFirm,
        related_name="panel_memberships",
        on_delete=models.CASCADE
    )
    
    is_active = models.BooleanField(default=True)
    
    # Preferences
    preferred_for_facility_types = models.JSONField(
        default=list,
        blank=True,
        help_text="Facility types this firm is preferred for"
    )
    preferred_for_regions = models.JSONField(
        default=list,
        blank=True,
        help_text="Regions this firm is preferred for"
    )
    
    added_at = models.DateTimeField(auto_now_add=True)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    class Meta:
        unique_together = ['lender', 'law_firm']
    
    def __str__(self) -> str:
        return f"{self.law_firm} on {self.lender} panel"


class PerformanceMetric(models.Model):
    """Aggregated performance metrics for SLA benchmarking."""
    
    METRIC_TYPE_CHOICES = [
        ('acknowledgment_time', 'Acknowledgment Time'),
        ('requisition_response_time', 'Requisition Response Time'),
        ('cp_satisfaction_time', 'CP Satisfaction Time'),
        ('completion_time', 'Completion Time'),
        ('stage_dwell_time', 'Stage Dwell Time'),
        ('task_completion_time', 'Task Completion Time'),
    ]
    
    # Target entity
    law_firm = models.ForeignKey(
        LawFirm,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="performance_metrics"
    )
    consultant_firm = models.CharField(max_length=200, blank=True, help_text="For non-panel consultants")
    solicitor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="solicitor_metrics"
    )
    
    metric_type = models.CharField(max_length=50, choices=METRIC_TYPE_CHOICES)
    
    # Aggregated values
    average_value = models.FloatField(help_text="Average in hours or days as appropriate")
    median_value = models.FloatField(null=True, blank=True)
    min_value = models.FloatField(null=True, blank=True)
    max_value = models.FloatField(null=True, blank=True)
    count = models.PositiveIntegerField(help_text="Number of observations")
    
    # Time period
    period_start = models.DateField()
    period_end = models.DateField()
    
    calculated_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-period_end', 'metric_type']
        indexes = [
            models.Index(fields=['law_firm', 'metric_type', '-period_end']),
        ]
    
    def __str__(self) -> str:
        entity = self.law_firm or self.consultant_firm or f"User {self.solicitor_user_id}"
        return f"{entity} - {self.metric_type} ({self.period_start} to {self.period_end})"
