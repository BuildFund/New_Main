"""Models for messaging between borrowers and lenders."""
from __future__ import annotations

from django.db import models
from django.conf import settings


class Message(models.Model):
    """Represents a message in a conversation between borrower and lender."""
    
    application = models.ForeignKey(
        "applications.Application",
        related_name="messages",
        on_delete=models.CASCADE,
        help_text="The application this message is related to",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="sent_messages",
        on_delete=models.CASCADE,
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="received_messages",
        on_delete=models.CASCADE,
    )
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["application", "-created_at"]),
            models.Index(fields=["recipient", "is_read"]),
        ]
    
    def __str__(self) -> str:
        return f"Message({self.sender.username} → {self.recipient.username})"


class MessageAttachment(models.Model):
    """Represents a file attachment to a message."""
    
    message = models.ForeignKey(
        Message,
        related_name="attachments",
        on_delete=models.CASCADE,
    )
    document = models.ForeignKey(
        "documents.Document",
        on_delete=models.CASCADE,
        help_text="Reference to the uploaded document",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self) -> str:
        return f"Attachment({self.message.id} - {self.document.file_name})"
