"""Serializers for messaging models."""
from __future__ import annotations

from rest_framework import serializers
from core.validators import sanitize_string
from .models import Message, MessageAttachment
from documents.serializers import DocumentSerializer


class MessageAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for message attachments."""
    
    document = DocumentSerializer(read_only=True)
    
    class Meta:
        model = MessageAttachment
        fields = ["id", "document", "created_at"]
        read_only_fields = ["id", "created_at"]


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for Message model."""
    
    sender_username = serializers.CharField(source="sender.username", read_only=True)
    recipient_username = serializers.CharField(source="recipient.username", read_only=True)
    project_reference = serializers.SerializerMethodField()
    attachments = MessageAttachmentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Message
        fields = [
            "id",
            "application",
            "sender",
            "sender_username",
            "recipient",
            "recipient_username",
            "project_reference",
            "subject",
            "body",
            "is_read",
            "read_at",
            "attachments",
            "created_at",
            "updated_at",
        ]
    
    def get_project_reference(self, obj):
        """Get the project reference from the application's project."""
        if obj.application and obj.application.project:
            return obj.application.project.project_reference or f"#{obj.application.project.id}"
        return None
        read_only_fields = [
            "id",
            "sender",
            "is_read",
            "read_at",
            "created_at",
            "updated_at",
        ]
    
    def create(self, validated_data):
        """Set sender from request user."""
        request = self.context.get("request")
        if request and request.user:
            validated_data["sender"] = request.user
        return super().create(validated_data)


class MessageCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating messages."""
    
    class Meta:
        model = Message
        fields = [
            "application",
            "recipient",
            "subject",
            "body",
        ]
    
    def validate_subject(self, value):
        """Sanitize subject field."""
        if value:
            return sanitize_string(value, max_length=255)
        return value
    
    def validate_body(self, value):
        """Sanitize message body."""
        if not value:
            raise serializers.ValidationError("Message body is required")
        return sanitize_string(value, max_length=10000)
    
    def create(self, validated_data):
        """Set sender from request user."""
        request = self.context.get("request")
        if request and request.user:
            validated_data["sender"] = request.user
        return super().create(validated_data)
