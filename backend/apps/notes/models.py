from django.conf import settings
from django.db import models


class Note(models.Model):
    class NoteType(models.TextChoices):
        QUICK = "quick", "Quick"
        CONTEXT = "context", "Context"
        SESSION = "session", "Session"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notes")
    note_type = models.CharField(max_length=20, choices=NoteType.choices)

    reference_type = models.CharField(max_length=30, blank=True)  # kanji/vocab/listening/session/...
    reference_id = models.PositiveBigIntegerField(null=True, blank=True)

    title = models.CharField(max_length=200, blank=True, default="")
    content = models.TextField()
    color = models.CharField(max_length=20, blank=True, default="")
    pinned = models.BooleanField(default=False)
    archived = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "note_type"]),
            models.Index(fields=["user", "reference_type", "reference_id"]),
        ]

    def __str__(self) -> str:
        return f"Note({self.user_id}, {self.note_type})"
