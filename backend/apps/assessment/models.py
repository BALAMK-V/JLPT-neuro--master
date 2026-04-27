from django.conf import settings
from django.db import models

from apps.content.models import JLPTLevel


class Test(models.Model):
    class TestType(models.TextChoices):
        KANJI = "kanji", "Kanji"
        VOCAB = "vocab", "Vocabulary"
        LISTENING = "listening", "Listening"
        MIXED = "mixed", "Mixed"

    title = models.CharField(max_length=255)
    test_type = models.CharField(max_length=20, choices=TestType.choices, default=TestType.MIXED)
    jlpt_level = models.CharField(max_length=2, choices=JLPTLevel.choices, default=JLPTLevel.N2)
    timed = models.BooleanField(default=False)
    duration_seconds = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_tests"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.title


class TestQuestion(models.Model):
    class ItemType(models.TextChoices):
        KANJI = "kanji", "Kanji"
        VOCAB = "vocab", "Vocabulary"
        LISTENING = "listening", "Listening"
        CUSTOM = "custom", "Custom"

    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name="questions")
    order = models.PositiveIntegerField(default=0)

    item_type = models.CharField(max_length=20, choices=ItemType.choices, default=ItemType.CUSTOM)
    item_id = models.PositiveBigIntegerField(null=True, blank=True)

    prompt = models.TextField(blank=True)
    choices = models.JSONField(default=dict, blank=True)  # {A: "...", B: "...", C: "...", D: "..."}
    correct_answer = models.CharField(max_length=10, blank=True)
    explanation = models.TextField(blank=True)

    class Meta:
        ordering = ["order", "id"]
        indexes = [models.Index(fields=["test", "order"]) ]

    def __str__(self) -> str:
        return f"TestQuestion({self.test_id}#{self.order})"
