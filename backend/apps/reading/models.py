from django.db import models

from apps.content.models import JLPTLevel


class ReadingPassage(models.Model):
    class PassageType(models.TextChoices):
        SHORT = "short", "Short passage"
        MEDIUM = "medium", "Medium passage"
        LONG = "long", "Long passage"
        INTEGRATED = "integrated", "Integrated comprehension"
        INFO_SEARCH = "info_search", "Information search"

    title = models.CharField(max_length=255)
    passage_type = models.CharField(max_length=20, choices=PassageType.choices, default=PassageType.MEDIUM)
    jlpt_level = models.CharField(max_length=2, choices=JLPTLevel.choices, default=JLPTLevel.N2)

    text_jp = models.TextField()
    text_en = models.TextField(blank=True)

    source = models.CharField(max_length=255, blank=True)
    tags = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["jlpt_level", "passage_type"]),
            models.Index(fields=["title"]),
        ]

    def __str__(self) -> str:
        return self.title


class ReadingQuestion(models.Model):
    class QuestionType(models.TextChoices):
        MAIN_IDEA = "main_idea", "Main idea"
        DETAIL = "detail", "Detail"
        INFERENCE = "inference", "Inference"
        PURPOSE = "purpose", "Purpose"
        VOCAB_IN_CONTEXT = "vocab", "Vocabulary in context"
        REFERENCE = "reference", "Reference / pronoun"
        INFO_SEARCH = "info_search", "Information search"
        OTHER = "other", "Other"

    passage = models.ForeignKey(ReadingPassage, on_delete=models.CASCADE, related_name="questions")
    order = models.PositiveIntegerField(default=0)

    question_type = models.CharField(max_length=20, choices=QuestionType.choices, default=QuestionType.OTHER)
    question = models.TextField()
    option_a = models.CharField(max_length=255)
    option_b = models.CharField(max_length=255)
    option_c = models.CharField(max_length=255)
    option_d = models.CharField(max_length=255)
    answer = models.CharField(max_length=1)  # A-D
    explanation = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]
        indexes = [models.Index(fields=["passage", "order"]), models.Index(fields=["question_type"])]

    def __str__(self) -> str:
        return f"ReadingQuestion({self.passage_id}#{self.order})"
