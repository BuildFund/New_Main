"""Admin configuration for documents app."""

from django.contrib import admin
from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("id", "file_name", "owner", "uploaded_at")
    search_fields = ("file_name", "owner__email", "description")