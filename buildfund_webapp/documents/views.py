"""Views for managing documents."""
from __future__ import annotations

from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .models import Document, DocumentType
from .serializers import DocumentSerializer


class DocumentViewSet(viewsets.ModelViewSet):
    """ViewSet for listing and creating documents."""

    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        """Return documents owned by the current user."""
        return Document.objects.filter(owner=self.request.user).order_by('-uploaded_at')
    
    def list(self, request, *args, **kwargs):
        """List documents with error handling."""
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in DocumentViewSet.list: {e}", exc_info=True)
            return Response(
                {"error": f"Failed to load documents: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
    
    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def upload(self, request):
        """Upload one or more files."""
        files = request.FILES.getlist('files')
        if not files:
            return Response(
                {"error": "No files provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uploaded_documents = []
        for file in files:
            document = Document.objects.create(
                owner=request.user,
                file_name=file.name,
                file_size=file.size,
                file_type=file.content_type or 'application/octet-stream',
                upload_path=f"uploads/{request.user.id}/{file.name}",
            )
            # In production, save file to S3 or local storage
            # For now, we just create the record
            uploaded_documents.append(DocumentSerializer(document).data)
        
        return Response({
            "message": f"Successfully uploaded {len(uploaded_documents)} file(s)",
            "documents": uploaded_documents,
        }, status=status.HTTP_201_CREATED)


class DocumentTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for listing document types."""
    
    queryset = DocumentType.objects.all()
    serializer_class = None  # We'll return simple dict
    permission_classes = [permissions.IsAuthenticated]
    
    def list(self, request):
        """List all document types."""
        loan_type = request.query_params.get("loan_type", "business_finance")
        
        # Get all document types
        all_doc_types = DocumentType.objects.all()
        
        # Filter document types based on loan type
        # SQLite doesn't support JSON contains lookup, so we filter in Python
        doc_types = []
        for dt in all_doc_types:
            # Include if loan_type is in required_for_loan_types, or if required_for_loan_types is empty
            if not dt.required_for_loan_types or loan_type in dt.required_for_loan_types:
                doc_types.append(dt)
        
        doc_types_data = [
            {
                "id": dt.id,
                "name": dt.name,
                "category": dt.category,
                "description": dt.description,
                "is_required": dt.is_required,
                "max_file_size_mb": dt.max_file_size_mb,
                "allowed_file_types": dt.allowed_file_types,
            }
            for dt in doc_types
        ]
        
        # Sort by category, then by name
        doc_types_data.sort(key=lambda x: (x["category"], x["name"]))
        
        return Response(doc_types_data)