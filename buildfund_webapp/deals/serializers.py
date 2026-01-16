"""Serializers for Deal Progression module."""
from __future__ import annotations

from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models import (
    Deal, DealParty, DealStage, DealTask, DealCP, DealRequisition,
    Drawdown, DealMessageThread, DealMessage, DealDocumentLink,
    DealDecision, AuditEvent, LawFirm, LawFirmPanelMembership, PerformanceMetric,
    ProviderEnquiry, ProviderQuote, DealProviderSelection, ProviderStageInstance,
    ProviderDeliverable, ProviderAppointment
)

User = get_user_model()


class DealSerializer(serializers.ModelSerializer):
    """Serializer for Deal model."""
    
    lender_name = serializers.CharField(source='lender.organisation_name', read_only=True)
    borrower_name = serializers.CharField(source='borrower_company.company_name', read_only=True)
    current_stage_name = serializers.CharField(source='current_stage.name', read_only=True)
    
    class Meta:
        model = Deal
        fields = [
            'id', 'deal_id', 'application', 'lender', 'lender_name',
            'borrower_company', 'borrower_name', 'status', 'facility_type',
            'jurisdiction', 'current_stage', 'current_stage_name',
            'accepted_at', 'target_completion_date', 'completed_at',
            'commercial_terms', 'completion_readiness_score',
            'completion_readiness_breakdown', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'deal_id', 'accepted_at', 'created_at', 'updated_at']


class DealPartySerializer(serializers.ModelSerializer):
    """Serializer for DealParty model."""
    
    user_name = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()
    party_type_display = serializers.CharField(source='get_party_type_display', read_only=True)
    
    def get_user_name(self, obj):
        """Get user name from user, borrower_profile, lender_profile, or consultant_profile."""
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        if obj.borrower_profile:
            return f"{obj.borrower_profile.first_name} {obj.borrower_profile.last_name}".strip()
        if obj.lender_profile:
            return obj.lender_profile.organisation_name
        if obj.consultant_profile:
            return f"{obj.consultant_profile.first_name} {obj.consultant_profile.last_name}".strip()
        return "Unknown"
    
    def get_user_email(self, obj):
        """Get user email from user, borrower_profile, lender_profile, or consultant_profile."""
        if obj.user:
            return obj.user.email
        if obj.borrower_profile:
            return obj.borrower_profile.user.email if obj.borrower_profile.user else ""
        if obj.lender_profile:
            return obj.lender_profile.contact_email
        if obj.consultant_profile:
            return obj.consultant_profile.user.email if obj.consultant_profile.user else ""
        return ""
    
    class Meta:
        model = DealParty
        fields = [
            'id', 'deal', 'user', 'user_name', 'user_email', 'party_type',
            'party_type_display', 'appointment_status', 'is_active_lender_solicitor',
            'invited_at', 'confirmed_at', 'access_granted_at',
            'acting_for_party', 'firm_name', 'sra_number', 'rics_number',
            'borrower_profile', 'lender_profile', 'consultant_profile',
            'invited_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'invited_at', 'access_granted_at', 'created_at', 'updated_at']


class DealStageSerializer(serializers.ModelSerializer):
    """Serializer for DealStage model."""
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = DealStage
        fields = [
            'id', 'deal', 'stage_number', 'name', 'description',
            'entry_criteria', 'exit_criteria', 'sla_target_days',
            'status', 'status_display', 'entered_at', 'completed_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class DealTaskSerializer(serializers.ModelSerializer):
    """Serializer for DealTask model."""
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    assignee_name = serializers.SerializerMethodField()
    
    def get_assignee_name(self, obj):
        """Get assignee name from user or party."""
        if obj.assignee_user:
            return obj.assignee_user.get_full_name() or obj.assignee_user.username
        if obj.assignee_party:
            if obj.assignee_party.user:
                return obj.assignee_party.user.get_full_name() or obj.assignee_party.user.username
        return None
    
    class Meta:
        model = DealTask
        fields = [
            'id', 'deal', 'stage', 'title', 'description', 'owner_party_type',
            'assignee_user', 'assignee_party', 'assignee_name', 'due_date',
            'sla_hours', 'dependencies', 'status', 'status_display',
            'priority', 'priority_display', 'required_docs', 'blockers',
            'created_at', 'updated_at', 'completed_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'completed_at']


class DealCPSerializer(serializers.ModelSerializer):
    """Serializer for DealCP (Conditions Precedent) model."""
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = DealCP
        fields = [
            'id', 'deal', 'stage', 'cp_number', 'title', 'description', 'is_mandatory',
            'owner_party_type', 'owner_party', 'due_date', 'status', 'status_display',
            'evidence_documents', 'satisfied_at', 'satisfied_by', 'approved_by',
            'approved_at', 'rejected_at', 'rejected_by', 'rejection_reason',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'satisfied_at', 'approved_at', 'rejected_at', 'created_at', 'updated_at']


class DealRequisitionSerializer(serializers.ModelSerializer):
    """Serializer for DealRequisition model."""
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    raised_by_name = serializers.SerializerMethodField()
    responded_by_name = serializers.SerializerMethodField()
    
    def get_raised_by_name(self, obj):
        """Get raised_by party name."""
        if obj.raised_by and obj.raised_by.user:
            return obj.raised_by.user.get_full_name() or obj.raised_by.user.username
        return "Unknown"
    
    def get_responded_by_name(self, obj):
        """Get responded_by user name."""
        if obj.responded_by:
            return obj.responded_by.get_full_name() or obj.responded_by.username
        return None
    
    class Meta:
        model = DealRequisition
        fields = [
            'id', 'deal', 'requisition_number', 'subject', 'question', 'response',
            'status', 'status_display', 'raised_by', 'raised_by_name',
            'assigned_to', 'responded_by', 'responded_by_name', 'responded_at',
            'response_documents', 'approved_at', 'approved_by', 'due_date',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'requisition_number', 'responded_at', 'approved_at', 'created_at', 'updated_at']


class DrawdownSerializer(serializers.ModelSerializer):
    """Serializer for Drawdown model."""
    
    lender_approval_status_display = serializers.CharField(source='get_lender_approval_status_display', read_only=True)
    approved_by_name = serializers.SerializerMethodField()
    ms_review_status_display = serializers.CharField(source='get_ms_review_status_display', read_only=True)
    ms_reviewed_by_name = serializers.SerializerMethodField()
    supporting_documents = serializers.SerializerMethodField()
    
    def get_approved_by_name(self, obj):
        """Get approved_by user name."""
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return None
    
    def get_ms_reviewed_by_name(self, obj):
        """Get ms_reviewed_by user name."""
        if obj.ms_reviewed_by:
            return obj.ms_reviewed_by.get_full_name() or obj.ms_reviewed_by.username
        return None
    
    def get_supporting_documents(self, obj):
        """Get supporting documents for this drawdown, grouped by category."""
        from .models import DealDocumentLink
        doc_links = DealDocumentLink.objects.filter(drawdown=obj).select_related('document', 'uploaded_by')
        return DealDocumentLinkSerializer(doc_links, many=True).data
    
    class Meta:
        model = Drawdown
        fields = [
            'id', 'deal', 'sequence_number', 'requested_amount', 'purpose',
            'requested_at', 'ims_inspection_required', 'ims_inspection_date',
            'ims_certificate_document', 'ims_report_document',
            'ms_review_status', 'ms_review_status_display', 'ms_reviewed_by', 'ms_reviewed_by_name',
            'ms_reviewed_at', 'ms_approved_at', 'ms_notes',
            'lender_approval_status', 'lender_approval_status_display', 'approved_by',
            'approved_by_name', 'approved_at', 'paid_at', 'payment_reference',
            'milestone', 'retention_amount', 'contingencies',
            'supporting_documents',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'requested_at', 'approved_at', 'paid_at', 'ms_reviewed_at', 'ms_approved_at', 'created_at', 'updated_at']


class DealMessageThreadSerializer(serializers.ModelSerializer):
    """Serializer for DealMessageThread model."""
    
    thread_type_display = serializers.CharField(source='get_thread_type_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    message_count = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    visible_to_party_names = serializers.SerializerMethodField()
    
    def get_created_by_name(self, obj):
        """Get created_by user name."""
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
    
    def get_message_count(self, obj):
        """Get count of messages in thread."""
        return obj.messages.count()
    
    def get_unread_count(self, obj):
        """Get count of unread messages (placeholder - would need read tracking)."""
        # TODO: Implement read tracking
        return 0
    
    def get_visible_to_party_names(self, obj):
        """Get names of parties that can see this thread."""
        parties = obj.visible_to_parties.all()
        names = []
        for party in parties:
            if party.user:
                names.append(party.user.get_full_name() or party.user.username)
            elif party.borrower_profile:
                names.append(party.borrower_profile.company_name or 'Borrower')
            elif party.lender_profile:
                names.append(party.lender_profile.organisation_name)
            elif party.consultant_profile:
                names.append(party.consultant_profile.organisation_name)
        return names
    
    class Meta:
        model = DealMessageThread
        fields = [
            'id', 'deal', 'thread_type', 'thread_type_display', 'subject',
            'created_by', 'created_by_name', 'visible_to_parties', 'visible_to_party_names',
            'visible_to_roles', 'is_private', 'message_count', 'unread_count',
            'created_at', 'updated_at', 'last_message_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_message_at', 'message_count', 'unread_count', 'visible_to_party_names']


class DealMessageSerializer(serializers.ModelSerializer):
    """Serializer for DealMessage model."""
    
    sender_name = serializers.SerializerMethodField()
    sender_user_name = serializers.SerializerMethodField()
    sender_role = serializers.SerializerMethodField()
    is_own_message = serializers.SerializerMethodField()
    
    def get_sender_name(self, obj):
        """Get sender party name."""
        if obj.sender:
            if obj.sender.user:
                return obj.sender.user.get_full_name() or obj.sender.user.username
            if obj.sender.borrower_profile:
                return obj.sender.borrower_profile.company_name or 'Borrower'
            if obj.sender.lender_profile:
                return obj.sender.lender_profile.organisation_name
            if obj.sender.consultant_profile:
                return obj.sender.consultant_profile.organisation_name
        return "Unknown"
    
    def get_sender_user_name(self, obj):
        """Get sender_user name."""
        if obj.sender_user:
            return obj.sender_user.get_full_name() or obj.sender_user.username
        return None
    
    def get_sender_role(self, obj):
        """Get sender's role/party type."""
        if obj.sender:
            return obj.sender.get_party_type_display() if hasattr(obj.sender, 'get_party_type_display') else obj.sender.party_type
        return None
    
    def get_is_own_message(self, obj):
        """Check if message is from current user."""
        request = self.context.get('request')
        if not request or not request.user:
            return False
        return obj.sender_user == request.user
    
    class Meta:
        model = DealMessage
        fields = [
            'id', 'thread', 'sender', 'sender_name', 'sender_role', 'sender_user', 'sender_user_name',
            'message', 'attachments', 'is_own_message', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_own_message']


class DealDocumentLinkSerializer(serializers.ModelSerializer):
    """Serializer for DealDocumentLink model."""
    
    uploaded_by_name = serializers.SerializerMethodField()
    visibility_display = serializers.CharField(source='get_visibility_display', read_only=True)
    document_category_display = serializers.CharField(source='get_document_category_display', read_only=True)
    
    def get_uploaded_by_name(self, obj):
        """Get uploaded_by user name."""
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return None
    
    document_file_name = serializers.CharField(source='document.file_name', read_only=True)
    document_file_size = serializers.IntegerField(source='document.file_size', read_only=True)
    document_file_type = serializers.CharField(source='document.file_type', read_only=True)
    
    class Meta:
        model = DealDocumentLink
        fields = [
            'id', 'deal', 'drawdown', 'document', 'document_category', 'document_category_display',
            'document_type_description', 'visibility', 'visibility_display', 'visible_to_consultants',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at', 'created_at',
            'document_file_name', 'document_file_size', 'document_file_type',
        ]
        read_only_fields = ['id', 'uploaded_at', 'created_at']


class DealDecisionSerializer(serializers.ModelSerializer):
    """Serializer for DealDecision model."""
    
    decision_type_display = serializers.CharField(source='get_decision_type_display', read_only=True)
    made_by_name = serializers.SerializerMethodField()
    made_by_party_name = serializers.SerializerMethodField()
    
    def get_made_by_name(self, obj):
        """Get made_by user name."""
        if obj.made_by:
            return obj.made_by.get_full_name() or obj.made_by.username
        return None
    
    def get_made_by_party_name(self, obj):
        """Get made_by_party name."""
        if obj.made_by_party:
            if obj.made_by_party.user:
                return obj.made_by_party.user.get_full_name() or obj.made_by_party.user.username
        return None
    
    class Meta:
        model = DealDecision
        fields = [
            'id', 'deal', 'decision_type', 'decision_type_display',
            'decision_text', 'made_by', 'made_by_name', 'made_by_party',
            'made_by_party_name', 'related_object_type', 'related_object_id',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class AuditEventSerializer(serializers.ModelSerializer):
    """Serializer for AuditEvent model."""
    
    actor_user_name = serializers.SerializerMethodField()
    actor_party_name = serializers.SerializerMethodField()
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    
    def get_actor_user_name(self, obj):
        """Get actor_user name."""
        if obj.actor_user:
            return obj.actor_user.get_full_name() or obj.actor_user.username
        return None
    
    def get_actor_party_name(self, obj):
        """Get actor_party name."""
        if obj.actor_party:
            if obj.actor_party.user:
                return obj.actor_party.user.get_full_name() or obj.actor_party.user.username
        return None
    
    class Meta:
        model = AuditEvent
        fields = [
            'id', 'deal', 'actor_user', 'actor_user_name', 'actor_party', 'actor_party_name',
            'event_type', 'event_type_display', 'timestamp', 'object_type', 'object_id',
            'diff_summary', 'metadata',
        ]
        read_only_fields = ['id', 'timestamp']


class LawFirmSerializer(serializers.ModelSerializer):
    """Serializer for LawFirm model."""
    
    class Meta:
        model = LawFirm
        fields = [
            'id', 'firm_name', 'sra_number', 'primary_contact_name',
            'primary_contact_email', 'primary_contact_phone', 'address',
            'coverage_regions', 'specialisms', 'compliance_validated',
            'compliance_validated_by', 'compliance_validated_at',
            'average_acknowledgment_hours', 'average_requisition_response_hours',
            'average_cp_satisfaction_hours', 'average_completion_days',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'compliance_validated_at', 'created_at', 'updated_at']


class LawFirmPanelMembershipSerializer(serializers.ModelSerializer):
    """Serializer for LawFirmPanelMembership model."""
    
    firm_name = serializers.CharField(source='law_firm.firm_name', read_only=True)
    added_by_name = serializers.SerializerMethodField()
    
    def get_added_by_name(self, obj):
        """Get added_by user name."""
        if obj.added_by:
            return obj.added_by.get_full_name() or obj.added_by.username
        return None
    
    class Meta:
        model = LawFirmPanelMembership
        fields = [
            'id', 'lender', 'law_firm', 'firm_name', 'is_active',
            'preferred_for_facility_types', 'preferred_for_regions',
            'added_at', 'added_by', 'added_by_name',
        ]
        read_only_fields = ['id', 'added_at']


class PerformanceMetricSerializer(serializers.ModelSerializer):
    """Serializer for PerformanceMetric model."""
    
    class Meta:
        model = PerformanceMetric
        fields = [
            'id', 'deal', 'party_type', 'firm_id', 'metric_type',
            'metric_value', 'period_start', 'period_end', 'metadata',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


# ============================================================================
# Provider Workflow Serializers
# ============================================================================

class ProviderEnquirySerializer(serializers.ModelSerializer):
    """Serializer for ProviderEnquiry model."""
    
    provider_firm_name = serializers.CharField(source='provider_firm.organisation_name', read_only=True)
    role_type_display = serializers.CharField(source='get_role_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    deal_id_display = serializers.CharField(source='deal.deal_id', read_only=True)
    has_quote = serializers.SerializerMethodField()
    
    class Meta:
        model = ProviderEnquiry
        fields = [
            'id', 'deal', 'deal_id_display', 'role_type', 'role_type_display',
            'provider_firm', 'provider_firm_name', 'status', 'status_display',
            'sent_at', 'viewed_at', 'quote_due_at', 'deal_summary_snapshot',
            'lender_notes', 'decline_reason', 'acknowledged_at', 'expected_quote_date',
            'acknowledgment_notes', 'has_quote', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'sent_at', 'viewed_at', 'acknowledged_at', 'created_at', 'updated_at']
    
    def get_has_quote(self, obj):
        """Check if enquiry has an associated quote."""
        return obj.quotes.exists()


class ProviderQuoteSerializer(serializers.ModelSerializer):
    """Serializer for ProviderQuote model."""
    
    enquiry_id = serializers.IntegerField(source='enquiry.id', read_only=True)
    provider_firm_name = serializers.CharField(source='enquiry.provider_firm.organisation_name', read_only=True)
    role_type_display = serializers.CharField(source='get_role_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    deal_id = serializers.CharField(source='enquiry.deal.deal_id', read_only=True)
    enquiry_acknowledged_at = serializers.DateTimeField(source='enquiry.acknowledged_at', read_only=True)
    enquiry_expected_quote_date = serializers.DateField(source='enquiry.expected_quote_date', read_only=True)
    enquiry_acknowledgment_notes = serializers.CharField(source='enquiry.acknowledgment_notes', read_only=True)
    
    class Meta:
        model = ProviderQuote
        fields = [
            'id', 'enquiry', 'enquiry_id', 'role_type', 'role_type_display',
            'price_gbp', 'lead_time_days', 'earliest_available_date',
            'scope_summary', 'assumptions', 'deliverables', 'validity_days',
            'payment_terms', 'status', 'status_display', 'version',
            'submitted_at', 'reviewed_at', 'accepted_at',
            'provider_notes', 'lender_notes', 'deal_id',
            'provider_firm_name', 'enquiry_acknowledged_at', 'enquiry_expected_quote_date',
            'enquiry_acknowledgment_notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'submitted_at', 'reviewed_at', 'accepted_at', 'created_at', 'updated_at']


class DealProviderSelectionSerializer(serializers.ModelSerializer):
    """Serializer for DealProviderSelection model."""
    
    provider_firm_name = serializers.CharField(source='provider_firm.organisation_name', read_only=True)
    role_type_display = serializers.CharField(source='get_role_type_display', read_only=True)
    selected_by_name = serializers.SerializerMethodField()
    lender_approved_by_name = serializers.SerializerMethodField()
    quote_amount = serializers.DecimalField(source='quote.price_gbp', read_only=True, max_digits=15, decimal_places=2)
    
    def get_selected_by_name(self, obj):
        if obj.selected_by:
            return obj.selected_by.get_full_name() or obj.selected_by.username
        return None
    
    def get_lender_approved_by_name(self, obj):
        if obj.lender_approved_by:
            return obj.lender_approved_by.get_full_name() or obj.lender_approved_by.username
        return None
    
    class Meta:
        model = DealProviderSelection
        fields = [
            'id', 'deal', 'role_type', 'role_type_display', 'provider_firm', 'provider_firm_name',
            'quote', 'quote_amount', 'selected_by', 'selected_by_name', 'selected_at',
            'lender_approval_required', 'lender_approved_at', 'lender_approved_by', 'lender_approved_by_name',
            'acting_for_party', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'selected_at', 'lender_approved_at', 'created_at', 'updated_at']


class ProviderStageInstanceSerializer(serializers.ModelSerializer):
    """Serializer for ProviderStageInstance model."""
    
    provider_firm_name = serializers.CharField(source='provider_firm.organisation_name', read_only=True)
    role_type_display = serializers.CharField(source='get_role_type_display', read_only=True)
    current_stage_display = serializers.SerializerMethodField()
    next_stage = serializers.SerializerMethodField()
    tasks = serializers.SerializerMethodField()
    
    class Meta:
        model = ProviderStageInstance
        fields = [
            'id', 'deal', 'role_type', 'role_type_display', 'provider_firm', 'provider_firm_name',
            'current_stage', 'current_stage_display', 'stage_entered_at', 'stage_history',
            'instructed_at', 'started_at', 'completed_at',
            'next_stage', 'tasks', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'stage_entered_at', 'created_at', 'updated_at']
    
    def get_current_stage_display(self, obj):
        """Get display name for current stage."""
        from .provider_workflow_templates import get_provider_stage_template
        template = get_provider_stage_template(obj.role_type, obj.current_stage)
        if template:
            return template.get('display_name', obj.current_stage.replace('_', ' ').title())
        return obj.current_stage.replace('_', ' ').title()
    
    def get_next_stage(self, obj):
        """Get next stage name if available."""
        from .provider_workflow_templates import get_next_provider_stage
        return get_next_provider_stage(obj.role_type, obj.current_stage)
    
    def get_tasks(self, obj):
        """Get tasks for this provider stage instance."""
        from .models import DealTask, DealParty
        
        # Find provider's party
        provider_party = DealParty.objects.filter(
            deal=obj.deal,
            consultant_profile=obj.provider_firm,
            party_type=obj.role_type
        ).first()
        
        if not provider_party:
            return []
        
        # Get tasks assigned to this provider party
        tasks = DealTask.objects.filter(
            deal=obj.deal,
            assignee_party=provider_party
        ).select_related('stage').order_by('due_date', 'priority', 'created_at')
        
        return DealTaskSerializer(tasks, many=True, context=self.context).data


class ProviderDeliverableSerializer(serializers.ModelSerializer):
    """Serializer for ProviderDeliverable model."""
    
    provider_firm_name = serializers.CharField(source='provider_firm.organisation_name', read_only=True)
    role_type_display = serializers.CharField(source='get_role_type_display', read_only=True)
    deliverable_type_display = serializers.CharField(source='get_deliverable_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    uploaded_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    document_name = serializers.CharField(source='document.file_name', read_only=True)
    document_size = serializers.IntegerField(source='document.file_size', read_only=True)
    document_url = serializers.SerializerMethodField()
    has_revisions = serializers.SerializerMethodField()
    revision_count = serializers.SerializerMethodField()
    
    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return None
    
    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return None
    
    def get_document_url(self, obj):
        """Get document download URL."""
        if obj.document:
            return f"/api/documents/{obj.document.id}/download/"
        return None
    
    def get_has_revisions(self, obj):
        """Check if this deliverable has revisions."""
        return obj.revisions.exists()
    
    def get_revision_count(self, obj):
        """Get count of revisions."""
        return obj.revisions.count()
    
    class Meta:
        model = ProviderDeliverable
        fields = [
            'id', 'deal', 'role_type', 'role_type_display', 'provider_firm', 'provider_firm_name',
            'deliverable_type', 'deliverable_type_display', 'status', 'status_display', 'version',
            'document', 'document_name', 'document_size', 'document_url',
            'uploaded_at', 'uploaded_by', 'uploaded_by_name',
            'reviewed_at', 'reviewed_by', 'reviewed_by_name', 'review_notes',
            'version_history', 'parent_deliverable', 'has_revisions', 'revision_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'uploaded_at', 'reviewed_at', 'version', 'version_history', 'created_at', 'updated_at']


class ProviderAppointmentSerializer(serializers.ModelSerializer):
    """Serializer for ProviderAppointment model."""
    
    provider_firm_name = serializers.CharField(source='provider_firm.organisation_name', read_only=True)
    role_type_display = serializers.CharField(source='get_role_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    proposed_by_name = serializers.SerializerMethodField()
    confirmed_by_name = serializers.SerializerMethodField()
    can_confirm = serializers.SerializerMethodField()
    can_reschedule = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()
    can_complete = serializers.SerializerMethodField()
    
    def get_proposed_by_name(self, obj):
        if obj.proposed_by:
            return obj.proposed_by.get_full_name() or obj.proposed_by.username
        return None
    
    def get_confirmed_by_name(self, obj):
        if obj.confirmed_by:
            return obj.confirmed_by.get_full_name() or obj.confirmed_by.username
        return None
    
    def get_can_confirm(self, obj):
        """Check if current user can confirm this appointment."""
        request = self.context.get('request')
        if not request or not request.user:
            return False
        is_borrower = hasattr(request.user, 'borrowerprofile') and obj.deal.borrower_company == request.user.borrowerprofile
        is_lender = hasattr(request.user, 'lenderprofile') and obj.deal.lender == request.user.lenderprofile
        return (is_borrower or is_lender) and obj.status == 'proposed'
    
    def get_can_reschedule(self, obj):
        """Check if current user can reschedule this appointment."""
        request = self.context.get('request')
        if not request or not request.user:
            return False
        is_borrower = hasattr(request.user, 'borrowerprofile') and obj.deal.borrower_company == request.user.borrowerprofile
        is_lender = hasattr(request.user, 'lenderprofile') and obj.deal.lender == request.user.lenderprofile
        is_provider = hasattr(request.user, 'consultantprofile') and obj.provider_firm == request.user.consultantprofile
        return (is_borrower or is_lender or is_provider) and obj.status in ['confirmed', 'rescheduled']
    
    def get_can_cancel(self, obj):
        """Check if current user can cancel this appointment."""
        request = self.context.get('request')
        if not request or not request.user:
            return False
        is_borrower = hasattr(request.user, 'borrowerprofile') and obj.deal.borrower_company == request.user.borrowerprofile
        is_lender = hasattr(request.user, 'lenderprofile') and obj.deal.lender == request.user.lenderprofile
        is_provider = hasattr(request.user, 'consultantprofile') and obj.provider_firm == request.user.consultantprofile
        return (is_borrower or is_lender or is_provider) and obj.status not in ['cancelled', 'completed']
    
    def get_can_complete(self, obj):
        """Check if current user can mark this appointment as completed."""
        request = self.context.get('request')
        if not request or not request.user:
            return False
        is_provider = hasattr(request.user, 'consultantprofile') and obj.provider_firm == request.user.consultantprofile
        is_lender = hasattr(request.user, 'lenderprofile') and obj.deal.lender == request.user.lenderprofile
        return (is_provider or is_lender) and obj.status in ['confirmed', 'rescheduled']
    
    class Meta:
        model = ProviderAppointment
        fields = [
            'id', 'deal', 'role_type', 'role_type_display', 'provider_firm', 'provider_firm_name',
            'status', 'status_display', 'date_time', 'location', 'notes',
            'proposed_slots', 'proposed_by', 'proposed_by_name',
            'confirmed_at', 'confirmed_by', 'confirmed_by_name',
            'can_confirm', 'can_reschedule', 'can_cancel', 'can_complete',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'confirmed_at', 'created_at', 'updated_at']
