from __future__ import annotations

from datetime import date, timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


class ItemType(models.TextChoices):
    KANJI = "kanji", "Kanji"
    VOCAB = "vocab", "Vocabulary"
    LISTENING = "listening", "Listening"
    TEST = "test", "Test"


class UserProgress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="progress_items")
    item_type = models.CharField(max_length=20, choices=ItemType.choices)
    item_id = models.PositiveBigIntegerField()

    accuracy = models.FloatField(default=0.0)
    attempts = models.PositiveIntegerField(default=0)
    correct_attempts = models.PositiveIntegerField(default=0)

    repetitions = models.PositiveIntegerField(default=0)
    interval_days = models.PositiveIntegerField(default=1)
    ease_factor = models.FloatField(default=2.5)

    last_reviewed = models.DateTimeField(null=True, blank=True)
    next_review_date = models.DateField(default=date.today)

    last_result_correct = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "item_type", "item_id")
        indexes = [
            models.Index(fields=["user", "next_review_date"]),
            models.Index(fields=["user", "item_type"]),
        ]

    def apply_review(self, correct: bool) -> None:
        """Basic spaced repetition: correct -> expand interval, wrong -> review soon."""
        now = timezone.now()
        self.attempts += 1
        if correct:
            self.correct_attempts += 1
        self.accuracy = (self.correct_attempts / max(1, self.attempts)) * 100.0

        self.last_reviewed = now
        self.last_result_correct = correct

        if not correct:
            self.repetitions = 0
            self.interval_days = 1
            self.ease_factor = max(1.3, self.ease_factor - 0.2)
        else:
            self.repetitions += 1
            self.ease_factor = min(2.8, self.ease_factor + 0.05)
            if self.repetitions == 1:
                self.interval_days = 1
            elif self.repetitions == 2:
                self.interval_days = 3
            else:
                self.interval_days = int(self.interval_days * self.ease_factor)

        self.next_review_date = (now + timedelta(days=self.interval_days)).date()


class Session(models.Model):
    class GoalType(models.TextChoices):
        KANJI = "kanji", "Kanji"
        VOCAB = "vocab", "Vocabulary"
        LISTENING = "listening", "Listening"
        MIXED = "mixed", "Mixed"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sessions")
    goal_type = models.CharField(max_length=20, choices=GoalType.choices, default=GoalType.MIXED)
    goal_target = models.PositiveIntegerField(default=20)
    progress_count = models.PositiveIntegerField(default=0)

    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(default=0)

    reflection = models.TextField(blank=True)
    summary = models.JSONField(default=dict, blank=True)

    def __str__(self) -> str:
        return f"Session({self.user_id}, {self.goal_type}, {self.started_at.date()})"
