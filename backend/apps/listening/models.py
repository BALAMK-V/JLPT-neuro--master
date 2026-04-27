from django.db import models

from apps.content.models import JLPTLevel


def listening_audio_path(instance, filename: str) -> str:
    return f"listening/audio/{filename}"


class ListeningQuestion(models.Model):
    class Section(models.TextChoices):
        KADAI = "kadai", "課題理解"
        POINT = "point", "ポイント理解"
        GAIYO = "gaiyo", "概要理解"
        SOKUJI = "sokuji", "即時応答"
        TOGO = "togo", "統合理解"
        OTHER = "other", "Other"

    class QuestionType(models.TextChoices):
        GIST = "gist", "Main idea (gist)"
        DETAIL = "detail", "Details"
        INFERENCE = "inference", "Inference"
        PURPOSE = "purpose", "Purpose"
        RESPONSE = "response", "Response"
        OTHER = "other", "Other"

    audio_file = models.FileField(upload_to=listening_audio_path, blank=True, null=True)
    audio_filename = models.CharField(max_length=255, blank=True)

    section = models.CharField(max_length=20, choices=Section.choices, default=Section.OTHER)
    question_type = models.CharField(max_length=20, choices=QuestionType.choices, default=QuestionType.OTHER)
    audio_text = models.TextField(blank=True)

    question = models.TextField()
    option_a = models.CharField(max_length=255)
    option_b = models.CharField(max_length=255)
    option_c = models.CharField(max_length=255)
    option_d = models.CharField(max_length=255)
    answer = models.CharField(max_length=1)  # A-D
    explanation = models.TextField(blank=True)
    jlpt_level = models.CharField(max_length=2, choices=JLPTLevel.choices, default=JLPTLevel.N2)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["jlpt_level"]),
            models.Index(fields=["jlpt_level", "section"]),
            models.Index(fields=["jlpt_level", "question_type"]),
        ]

    def __str__(self) -> str:
        return f"ListeningQuestion({self.id})"
