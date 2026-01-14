"""Serializers for consultants app."""
from rest_framework import serializers
from .models import ConsultantProfile, ConsultantService, ConsultantQuote, ConsultantAppointment


class ConsultantProfileSerializer(serializers.ModelSerializer):
    """Serializer for ConsultantProfile."""
    
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)
    
    class Meta:
        model = ConsultantProfile
        fields = [
            "id",
            "user",
            "user_email",
            "user_username",
            "mobile_number",
            "mfa_enabled",
            "consent_privacy",
            "consent_terms",
            "consent_credit_search",
            "organisation_name",
            "trading_name",
            "company_registration_number",
            "company_data",
            "company_verified_at",
            "trading_address",
            "directors_data",
            "shareholders_data",
            "account_holder_is_director",
            "account_holder_name",
            "account_holder_role",
            "services_offered",
            "primary_service",
            "qualifications",
            "professional_registration_numbers",
            "insurance_details",
            "compliance_certifications",
            "contact_email",
            "contact_phone",
            "website",
            "address_line_1",
            "address_line_2",
            "city",
            "county",
            "postcode",
            "country",
            "geographic_coverage",
            "service_description",
            "years_of_experience",
            "team_size",
            "key_personnel",
            "current_capacity",
            "max_capacity",
            "average_response_time_days",
            "is_active",
            "is_verified",
            "verified_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "verified_at"]


class ConsultantServiceSerializer(serializers.ModelSerializer):
    """Serializer for ConsultantService."""
    
    application_id = serializers.IntegerField(source="application.id", read_only=True)
    project_description = serializers.CharField(source="application.project.description", read_only=True)
    quotes_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ConsultantService
        fields = [
            "id",
            "application",
            "application_id",
            "project_description",
            "service_type",
            "description",
            "required_by_date",
            "status",
            "required_qualifications",
            "geographic_requirement",
            "minimum_experience_years",
            "quotes_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
    
    def get_quotes_count(self, obj):
        return obj.quotes.count()


class ConsultantQuoteSerializer(serializers.ModelSerializer):
    """Serializer for ConsultantQuote."""
    
    consultant_name = serializers.CharField(source="consultant.organisation_name", read_only=True)
    service_type = serializers.CharField(source="service.service_type", read_only=True)
    application_id = serializers.IntegerField(source="service.application.id", read_only=True)
    
    class Meta:
        model = ConsultantQuote
        fields = [
            "id",
            "consultant",
            "consultant_name",
            "service",
            "service_type",
            "application_id",
            "quote_amount",
            "quote_breakdown",
            "estimated_completion_date",
            "payment_terms",
            "service_description",
            "deliverables",
            "timeline",
            "terms_and_conditions",
            "validity_period_days",
            "status",
            "submitted_at",
            "reviewed_at",
            "accepted_at",
            "notes",
        ]
        read_only_fields = ["id", "submitted_at", "reviewed_at", "accepted_at"]


class ConsultantAppointmentSerializer(serializers.ModelSerializer):
    """Serializer for ConsultantAppointment."""
    
    consultant_name = serializers.CharField(source="consultant.organisation_name", read_only=True)
    service_type = serializers.CharField(source="service.service_type", read_only=True)
    application_id = serializers.IntegerField(source="service.application.id", read_only=True)
    quote_amount = serializers.DecimalField(source="quote.quote_amount", read_only=True, max_digits=15, decimal_places=2)
    
    class Meta:
        model = ConsultantAppointment
        fields = [
            "id",
            "consultant",
            "consultant_name",
            "service",
            "service_type",
            "application_id",
            "quote",
            "quote_amount",
            "appointment_date",
            "start_date",
            "expected_completion_date",
            "actual_completion_date",
            "status",
            "documents",
            "file_url",
            "progress_notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "appointment_date", "created_at", "updated_at"]
    
    def to_representation(self, instance):
        """Add file URLs for documents."""
        representation = super().to_representation(instance)
        if instance.documents.exists():
            representation['documents'] = [
                {
                    'id': doc.id,
                    'name': doc.file_name,
                    'filename': doc.file_name,
                    'file_url': None,  # Document model doesn't have file field, only file_name
                    'url': None,
                }
                for doc in instance.documents.all()
            ]
        return representation
