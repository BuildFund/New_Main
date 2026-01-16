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
        from .services import DealService
        DealService.update_completion_readiness(self)


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
    confirmed_at = models.DateTimeField(null=True, blank=True, help_text="When consultant confirmed appointment")
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
    
    # MS (Monitoring Surveyor) workflow
    ms_review_status = models.CharField(
        max_length=30,
        choices=[
            ('pending', 'Pending MS Review'),
            ('under_review', 'Under MS Review'),
            ('site_visit_scheduled', 'Site Visit Scheduled'),
            ('site_visit_completed', 'Site Visit Completed'),
            ('ms_approved', 'MS Approved for Lender Review'),
            ('ms_rejected', 'MS Rejected'),
        ],
        default='pending'
    )
    ms_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ms_reviewed_drawdowns",
        help_text="Monitoring Surveyor who reviewed this drawdown"
    )
    ms_reviewed_at = models.DateTimeField(null=True, blank=True)
    ms_approved_at = models.DateTimeField(null=True, blank=True)
    ms_notes = models.TextField(blank=True, help_text="MS review notes and comments")
    
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
    
    # Creator
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_message_threads",
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    # Visibility - who can see this thread (party-based scoping)
    visible_to_parties = models.ManyToManyField(
        DealParty,
        related_name="accessible_threads",
        help_text="Parties that can view and participate in this thread"
    )
    
    # Role-based scoping (additional to party scoping)
    visible_to_roles = models.JSONField(
        default=list,
        blank=True,
        help_text="List of roles that can see this thread (e.g., ['lender', 'borrower', 'valuer'])"
    )
    
    # Private thread flag
    is_private = models.BooleanField(
        default=False,
        help_text="If True, only explicitly added parties can see this thread"
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
            # Drawdown-specific categories
            ('drawdown_progress_reports', 'Drawdown: Progress Reports'),
            ('drawdown_photos', 'Drawdown: Photos'),
            ('drawdown_consultants_building_control', 'Drawdown: Consultants & Building Control'),
            ('drawdown_other', 'Drawdown: Other'),
        ]
    )
    # Document type/description for drawdown documents
    document_type_description = models.CharField(
        max_length=200,
        blank=True,
        help_text="Description or type of document (e.g., 'Site Visit Photos', 'Progress Report Week 4')"
    )
    # Optional link to specific drawdown (for drawdown-related documents)
    drawdown = models.ForeignKey(
        'Drawdown',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='supporting_documents',
        help_text="If this document is related to a specific drawdown request"
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
        # Provider-specific metrics
        ('quote_response_time', 'Quote Response Time'),  # Time from enquiry sent to quote submitted (hours)
        ('quote_acceptance_rate', 'Quote Acceptance Rate'),  # Percentage of quotes accepted
        ('deliverable_delivery_time', 'Deliverable Delivery Time'),  # Time from instruction to deliverable approved (days)
        ('deliverable_rework_count', 'Deliverable Rework Count'),  # Number of rejected/revised deliverables
        ('appointment_lead_time', 'Appointment Lead Time'),  # Time from proposal to confirmation (hours)
        ('time_to_completion_impact', 'Time to Completion Impact'),  # Days added/subtracted from deal completion
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
    provider_firm = models.ForeignKey(
        "consultants.ConsultantProfile",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="performance_metrics",
        help_text="Provider firm (consultant/solicitor) for provider-specific metrics"
    )
    role_type = models.CharField(
        max_length=30,
        choices=ProviderEnquiry.ROLE_TYPE_CHOICES if 'ProviderEnquiry' in globals() else [],
        null=True,
        blank=True,
        help_text="Provider role type (valuer, monitoring_surveyor, solicitor) for provider metrics"
    )
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
            models.Index(fields=['provider_firm', 'role_type', 'metric_type', '-period_end']),
        ]
    
    def __str__(self) -> str:
        if self.provider_firm:
            role_choices = [
                ('valuer', 'Valuer'),
                ('monitoring_surveyor', 'Monitoring Surveyor'),
                ('solicitor', 'Solicitor'),
            ]
            role_display = dict(role_choices).get(self.role_type, self.role_type) if self.role_type else 'Provider'
            entity = f"{self.provider_firm.organisation_name} ({role_display})"
        elif self.law_firm:
            entity = str(self.law_firm)
        elif self.consultant_firm:
            entity = self.consultant_firm
        elif self.solicitor_user:
            entity = f"User {self.solicitor_user_id}"
        else:
            entity = "Unknown"
        return f"{entity} - {self.get_metric_type_display()} ({self.period_start} to {self.period_end})"


# ============================================================================
# Deal-Level Provider Workflow Models
# ============================================================================

class ProviderEnquiry(models.Model):
    """Represents a quote request sent to a provider firm for a specific role on a deal."""
    
    ROLE_TYPE_CHOICES = [
        ('valuer', 'Valuer'),
        ('monitoring_surveyor', 'Monitoring Surveyor'),
        ('solicitor', 'Solicitor'),
    ]
    
    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('received', 'Received'),  # Consultant has marked as received
        ('acknowledged', 'Acknowledged'),  # Consultant acknowledged and will quote
        ('preparing_quote', 'Preparing Quote'),  # Consultant is actively preparing quote
        ('queries_raised', 'Queries Raised'),  # Consultant has questions before quoting
        ('ready_to_submit', 'Ready to Submit'),  # Quote prepared, ready to submit
        ('quoted', 'Quoted'),  # Quote has been submitted
        ('declined', 'Declined'),
        ('expired', 'Expired'),
    ]
    
    deal = models.ForeignKey(
        Deal,
        related_name="provider_enquiries",
        on_delete=models.CASCADE
    )
    role_type = models.CharField(max_length=30, choices=ROLE_TYPE_CHOICES)
    provider_firm = models.ForeignKey(
        "consultants.ConsultantProfile",
        related_name="deal_enquiries",
        on_delete=models.CASCADE,
        help_text="The consultant/solicitor firm this enquiry is sent to"
    )
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='sent')
    sent_at = models.DateTimeField(auto_now_add=True)
    viewed_at = models.DateTimeField(null=True, blank=True)
    quote_due_at = models.DateTimeField(null=True, blank=True, help_text="Deadline for quote submission")
    
    # Acknowledgment fields
    acknowledged_at = models.DateTimeField(null=True, blank=True, help_text="When provider acknowledged they will quote")
    expected_quote_date = models.DateField(null=True, blank=True, help_text="Provider's expected quote submission date")
    acknowledgment_notes = models.TextField(blank=True, help_text="Provider's notes when acknowledging (e.g., timeline, questions)")
    
    # Deal summary snapshot (redacted for provider)
    deal_summary_snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text="Snapshot of deal information visible to provider (redacted)"
    )
    
    # Notes
    lender_notes = models.TextField(blank=True, help_text="Internal notes from lender")
    decline_reason = models.TextField(blank=True, help_text="Reason if declined by provider")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Provider Enquiry"
        verbose_name_plural = "Provider Enquiries"
        ordering = ['-sent_at']
        indexes = [
            models.Index(fields=['deal', 'role_type', 'status']),
            models.Index(fields=['provider_firm', 'status']),
        ]
    
    def __str__(self) -> str:
        return f"Enquiry: {self.get_role_type_display()} for {self.deal} - {self.provider_firm.organisation_name}"


class ProviderQuote(models.Model):
    """Represents a quote submitted by a provider in response to an enquiry."""
    
    STATUS_CHOICES = [
        ('submitted', 'Submitted'),
        ('under_review', 'Under Review'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('withdrawn', 'Withdrawn'),
        ('expired', 'Expired'),
    ]
    
    enquiry = models.ForeignKey(
        ProviderEnquiry,
        related_name="quotes",
        on_delete=models.CASCADE
    )
    role_type = models.CharField(max_length=30, choices=ProviderEnquiry.ROLE_TYPE_CHOICES)
    
    # Quote details
    price_gbp = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        help_text="Total quote price in GBP"
    )
    lead_time_days = models.PositiveIntegerField(help_text="Estimated lead time in days")
    earliest_available_date = models.DateField(null=True, blank=True)
    
    # Scope and assumptions
    scope_summary = models.TextField(help_text="Summary of services included in quote")
    assumptions = models.TextField(blank=True, help_text="Assumptions and exclusions")
    deliverables = models.JSONField(
        default=list,
        blank=True,
        help_text="List of deliverables included"
    )
    
    # Terms
    validity_days = models.PositiveIntegerField(default=30, help_text="Quote validity period in days")
    payment_terms = models.TextField(blank=True)
    
    # Status and versioning
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted')
    version = models.PositiveIntegerField(default=1, help_text="Quote version number")
    
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    
    # Notes
    provider_notes = models.TextField(blank=True, help_text="Internal notes from provider")
    lender_notes = models.TextField(blank=True, help_text="Internal notes from lender")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Provider Quote"
        verbose_name_plural = "Provider Quotes"
        ordering = ['-submitted_at']
        indexes = [
            models.Index(fields=['enquiry', 'status']),
        ]
    
    def __str__(self) -> str:
        return f"Quote: {self.get_role_type_display()} - £{self.price_gbp} ({self.enquiry.deal})"


class DealProviderSelection(models.Model):
    """Represents the selection of a provider for a specific role on a deal."""
    
    ROLE_TYPE_CHOICES = [
        ('valuer', 'Valuer'),
        ('monitoring_surveyor', 'Monitoring Surveyor'),
        ('solicitor', 'Solicitor'),
    ]
    
    deal = models.ForeignKey(
        Deal,
        related_name="provider_selections",
        on_delete=models.CASCADE
    )
    role_type = models.CharField(max_length=30, choices=ROLE_TYPE_CHOICES)
    provider_firm = models.ForeignKey(
        "consultants.ConsultantProfile",
        related_name="deal_selections",
        on_delete=models.CASCADE
    )
    quote = models.ForeignKey(
        ProviderQuote,
        related_name="selections",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="The quote that was accepted (if applicable)"
    )
    
    # Selection details
    selected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="provider_selections_made",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="User who made the selection (borrower or lender)"
    )
    selected_at = models.DateTimeField(auto_now_add=True)
    
    # Lender approval
    lender_approval_required = models.BooleanField(
        default=True,
        help_text="Whether lender approval is required for this selection"
    )
    lender_approved_at = models.DateTimeField(null=True, blank=True)
    lender_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="provider_selections_approved",
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    # Acting for party (for solicitors)
    acting_for_party = models.CharField(
        max_length=20,
        choices=DealParty.ACTING_FOR_CHOICES,
        null=True,
        blank=True,
        help_text="Required for solicitors: acting for lender or borrower"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Deal Provider Selection"
        verbose_name_plural = "Deal Provider Selections"
        unique_together = [('deal', 'role_type')]  # One provider per role per deal
        ordering = ['deal', 'role_type']
        indexes = [
            models.Index(fields=['deal', 'role_type']),
            models.Index(fields=['provider_firm']),
        ]
    
    def __str__(self) -> str:
        return f"Selection: {self.get_role_type_display()} for {self.deal} - {self.provider_firm.organisation_name}"


class ProviderStageInstance(models.Model):
    """Tracks the current stage and progress for a provider on a deal."""
    
    ROLE_TYPE_CHOICES = [
        ('valuer', 'Valuer'),
        ('monitoring_surveyor', 'Monitoring Surveyor'),
        ('solicitor', 'Solicitor'),
    ]
    
    deal = models.ForeignKey(
        Deal,
        related_name="provider_stages",
        on_delete=models.CASCADE
    )
    role_type = models.CharField(max_length=30, choices=ROLE_TYPE_CHOICES)
    provider_firm = models.ForeignKey(
        "consultants.ConsultantProfile",
        related_name="deal_stage_instances",
        on_delete=models.CASCADE
    )
    
    # Stage tracking
    current_stage = models.CharField(
        max_length=50,
        help_text="Current stage name (e.g., 'instructed', 'inspection_completed')"
    )
    stage_entered_at = models.DateTimeField(auto_now_add=True)
    
    # Stage history (JSON array of {stage, entered_at, exited_at})
    stage_history = models.JSONField(
        default=list,
        blank=True,
        help_text="History of stage transitions"
    )
    
    # Timestamps for key milestones
    instructed_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Provider Stage Instance"
        verbose_name_plural = "Provider Stage Instances"
        unique_together = [('deal', 'role_type', 'provider_firm')]
        ordering = ['deal', 'role_type']
        indexes = [
            models.Index(fields=['deal', 'role_type']),
            models.Index(fields=['provider_firm', 'current_stage']),
        ]
    
    def __str__(self) -> str:
        return f"Stage: {self.get_role_type_display()} for {self.deal} - {self.current_stage}"


class ProviderDeliverable(models.Model):
    """Represents a deliverable (document/report) uploaded by a provider."""
    
    DELIVERABLE_TYPE_CHOICES = [
        # Valuer deliverables
        ('valuation_report', 'Valuation Report'),
        ('reliance_letter', 'Reliance Letter'),
        # IMS deliverables
        ('ims_initial_report', 'IMS Initial Report'),
        ('monitoring_report', 'Monitoring Report'),
        ('drawdown_certificate', 'Drawdown Certificate'),
        # Solicitor deliverables
        ('legal_doc_pack', 'Legal Document Pack'),
        ('cp_evidence', 'CP Evidence'),
        ('completion_statement', 'Completion Statement'),
    ]
    
    STATUS_CHOICES = [
        ('uploaded', 'Uploaded'),
        ('under_review', 'Under Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('revised', 'Revised'),
    ]
    
    deal = models.ForeignKey(
        Deal,
        related_name="provider_deliverables",
        on_delete=models.CASCADE
    )
    role_type = models.CharField(max_length=30, choices=ProviderEnquiry.ROLE_TYPE_CHOICES)
    provider_firm = models.ForeignKey(
        "consultants.ConsultantProfile",
        related_name="deal_deliverables",
        on_delete=models.CASCADE
    )
    
    deliverable_type = models.CharField(max_length=50, choices=DELIVERABLE_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='uploaded')
    version = models.PositiveIntegerField(default=1)
    
    # Document link
    document = models.ForeignKey(
        "documents.Document",
        related_name="provider_deliverables",
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    
    # Review workflow
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="deliverables_uploaded",
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="deliverables_reviewed",
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True, help_text="Review comments/notes")
    
    # Version history (JSON array of {version, document_id, uploaded_at, uploaded_by, status, review_notes})
    version_history = models.JSONField(
        default=list,
        blank=True,
        help_text="History of all versions of this deliverable"
    )
    
    # Parent deliverable (for tracking revisions)
    parent_deliverable = models.ForeignKey(
        'self',
        related_name="revisions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Previous version if this is a revision"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Provider Deliverable"
        verbose_name_plural = "Provider Deliverables"
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['deal', 'role_type', 'status']),
            models.Index(fields=['provider_firm', 'status']),
        ]
    
    def __str__(self) -> str:
        return f"{self.get_deliverable_type_display()} v{self.version} - {self.deal} ({self.get_status_display()})"


class ProviderAppointment(models.Model):
    """Represents an appointment (site visit, meeting) for a provider on a deal."""
    
    ROLE_TYPE_CHOICES = [
        ('valuer', 'Valuer'),
        ('monitoring_surveyor', 'Monitoring Surveyor'),
        ('solicitor', 'Solicitor'),
    ]
    
    STATUS_CHOICES = [
        ('proposed', 'Proposed'),
        ('confirmed', 'Confirmed'),
        ('rescheduled', 'Rescheduled'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    ]
    
    deal = models.ForeignKey(
        Deal,
        related_name="provider_appointments",
        on_delete=models.CASCADE
    )
    role_type = models.CharField(max_length=30, choices=ROLE_TYPE_CHOICES)
    provider_firm = models.ForeignKey(
        "consultants.ConsultantProfile",
        related_name="deal_appointments",
        on_delete=models.CASCADE
    )
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='proposed')
    date_time = models.DateTimeField(null=True, blank=True, help_text="Scheduled date and time")
    location = models.CharField(max_length=500, blank=True, help_text="Appointment location/address")
    notes = models.TextField(blank=True, help_text="Appointment notes/agenda")
    
    # Proposed time slots (for initial proposal)
    proposed_slots = models.JSONField(
        default=list,
        blank=True,
        help_text="List of proposed time slots [{date_time, notes}]"
    )
    
    # Booking workflow
    proposed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="appointments_proposed",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="User who proposed the appointment (usually provider)"
    )
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="appointments_confirmed",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="User who confirmed the appointment (usually borrower)"
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Provider Appointment"
        verbose_name_plural = "Provider Appointments"
        ordering = ['date_time', '-created_at']
        indexes = [
            models.Index(fields=['deal', 'role_type', 'status']),
            models.Index(fields=['provider_firm', 'date_time']),
        ]
    
    def __str__(self) -> str:
        return f"Appointment: {self.get_role_type_display()} for {self.deal} - {self.get_status_display()}"
