"""Serializers for the underwriting app.

Serializers define the API representation of underwriting reports and
handle validation of incoming data when generating new reports.
"""

from __future__ import annotations

from rest_framework import serializers

from .models import UnderwritingReport
from projects.models import Project


class UnderwritingReportSerializer(serializers.ModelSerializer):
    """Serializer for existing underwriting reports."""

    class Meta:
        model = UnderwritingReport
        fields = [
            "id",
            "project",
            "borrower",
            "lender",
            "report_type",
            "content",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["content", "created_at", "updated_at"]


class GenerateUnderwritingReportSerializer(serializers.Serializer):
    """Serializer for generating a new underwriting report via ChatGPT.

    This serializer accepts minimal input: a project ID and a report
    type.  It validates that the specified project exists and that
    the report type is supported.
    """

    project_id = serializers.IntegerField()
    report_type = serializers.ChoiceField(choices=UnderwritingReport.REPORT_TYPES)

    def validate_project_id(self, value: int) -> int:
        try:
            Project.objects.get(pk=value)
        except Project.DoesNotExist as exc:
            raise serializers.ValidationError("Invalid project ID") from exc
        return value
