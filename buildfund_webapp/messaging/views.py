"""Views for messaging system."""
from __future__ import annotations

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q

from .models import Message, MessageAttachment
from .serializers import MessageSerializer, MessageCreateSerializer, MessageAttachmentSerializer
from accounts.permissions import IsBorrower, IsLender


class MessageViewSet(viewsets.ModelViewSet):
    """ViewSet for messages."""
    
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return messages where user is sender or recipient."""
        user = self.request.user
        return Message.objects.filter(
            Q(sender=user) | Q(recipient=user)
        ).select_related("sender", "recipient", "application")
    
    def perform_create(self, serializer):
        """Create message and send email notification."""
        message = serializer.save()
        
        # Send email notification to recipient
        try:
            from notifications.services import EmailNotificationService
            recipient_email = message.recipient.email
            if recipient_email:
                EmailNotificationService.notify_new_message(message, recipient_email)
        except Exception as e:
            print(f"Failed to send message notification email: {e}")
        
        return message
    
    def get_serializer_class(self):
        """Use different serializer for create."""
        if self.action == "create":
            return MessageCreateSerializer
        return MessageSerializer
    
    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        """Mark a message as read."""
        message = self.get_object()
        
        # Only recipient can mark as read
        if message.recipient != request.user:
            return Response(
                {"error": "Only the recipient can mark a message as read"},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        if not message.is_read:
            message.is_read = True
            message.read_at = timezone.now()
            message.save()
        
        serializer = self.get_serializer(message)
        return Response(serializer.data)
    
    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        """Get count of unread messages for current user."""
        count = Message.objects.filter(
            recipient=request.user,
            is_read=False
        ).count()
        return Response({"unread_count": count})
    
    @action(detail=False, methods=["get"])
    def by_application(self, request):
        """Get all messages for a specific application."""
        application_id = request.query_params.get("application_id")
        if not application_id:
            return Response(
                {"error": "application_id parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        messages = Message.objects.filter(
            application_id=application_id
        ).filter(
            Q(sender=request.user) | Q(recipient=request.user)
        ).select_related("sender", "recipient").prefetch_related("attachments__document").order_by("created_at")
        
        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data)


class MessageAttachmentViewSet(viewsets.ModelViewSet):
    """ViewSet for message attachments."""
    
    serializer_class = MessageAttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return attachments for messages user has access to."""
        user = self.request.user
        return MessageAttachment.objects.filter(
            Q(message__sender=user) | Q(message__recipient=user)
        ).select_related("message", "document")
