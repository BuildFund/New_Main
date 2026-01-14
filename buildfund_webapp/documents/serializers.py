"""Serializers for documents."""
from __future__ import annotations

from rest_framework import serializers

from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    """Serializer for Document model."""

    class Meta:
        model = Document
        fields = [
            "id",
            "owner",
            "file_name",
            "file_size",
            "file_type",
            "upload_path",
            "uploaded_at",
            "description",
        ]
        read_only_fields = ["id", "owner", "uploaded_at"]