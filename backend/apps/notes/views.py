from rest_framework import permissions, viewsets

from .models import Note
from .serializers import NoteSerializer


class NoteViewSet(viewsets.ModelViewSet):
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["note_type", "reference_type", "reference_id", "pinned", "archived"]
    search_fields = ["title", "content"]
    ordering_fields = ["updated_at", "created_at", "pinned"]

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return Note.objects.filter(user=self.request.user)
