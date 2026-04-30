from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.content.models import JLPTLevel


class QuestionPaper(models.Model):
    """An uploaded JLPT question paper (image or PDF) awaiting OCR processing."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    class FileType(models.TextChoices):
        IMAGE = "image", "Image (JPG/PNG/BMP/TIFF)"
        PDF = "pdf", "PDF"

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="uploaded_papers",
    )
    file = models.FileField(upload_to="ocr/uploads/")
    file_type = models.CharField(max_length=10, choices=FileType.choices)
    original_filename = models.CharField(max_length=255, blank=True)

    level = models.CharField(max_length=2, choices=JLPTLevel.choices, default=JLPTLevel.N3)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    extracted_text = models.TextField(blank=True)
    # Regex-parsed questions — always present after OCR
    parsed_questions = models.JSONField(default=list, blank=True)
    # AI-cleaned questions — present after "AI Parse" is triggered
    ai_parsed_questions = models.JSONField(default=list, blank=True)

    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"QuestionPaper({self.original_filename}, {self.level}, {self.status})"

    @property
    def question_count(self) -> int:
        return len(self.parsed_questions) if self.parsed_questions else 0
