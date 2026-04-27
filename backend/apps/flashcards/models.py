from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.content.models import Kanji, JLPTLevel, Vocabulary


class Deck(models.Model):
    class DeckType(models.TextChoices):
        KANJI = "kanji", "Kanji"
        VOCAB = "vocab", "Vocabulary"
        CUSTOM = "custom", "Custom"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="flash_decks")
    name = models.CharField(max_length=120)
    deck_type = models.CharField(max_length=20, choices=DeckType.choices, default=DeckType.CUSTOM)
    jlpt_level = models.CharField(max_length=2, choices=JLPTLevel.choices, default=JLPTLevel.N2)
    system_key = models.CharField(max_length=20, blank=True, default="")
    is_locked = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "name")
        indexes = [
            models.Index(fields=["user", "deck_type"]),
            models.Index(fields=["user", "jlpt_level"]),
        ]

    def __str__(self) -> str:
        return f"Deck({self.user_id}, {self.name})"


class Card(models.Model):
    class Rating(models.TextChoices):
        AGAIN = "again", "Again"
        HARD = "hard", "Hard"
        GOOD = "good", "Good"
        EASY = "easy", "Easy"

    deck = models.ForeignKey(Deck, on_delete=models.CASCADE, related_name="cards")

    # Optional links to global content
    kanji = models.ForeignKey(Kanji, null=True, blank=True, on_delete=models.SET_NULL, related_name="flash_cards")
    vocab = models.ForeignKey(Vocabulary, null=True, blank=True, on_delete=models.SET_NULL, related_name="flash_cards")

    front = models.TextField()
    back = models.TextField()

    tags = models.JSONField(default=list, blank=True)
    suspended = models.BooleanField(default=False)

    # Anki-like scheduling (simplified)
    repetitions = models.PositiveIntegerField(default=0)
    interval_days = models.PositiveIntegerField(default=0)
    ease_factor = models.FloatField(default=2.5)
    due_at = models.DateTimeField(default=timezone.now)
    last_reviewed = models.DateTimeField(null=True, blank=True)
    lapses = models.PositiveIntegerField(default=0)
    last_rating = models.CharField(max_length=10, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["deck", "kanji"], name="uniq_card_deck_kanji"),
            models.UniqueConstraint(fields=["deck", "vocab"], name="uniq_card_deck_vocab"),
        ]
        indexes = [
            models.Index(fields=["deck", "due_at"]),
            models.Index(fields=["deck", "suspended"]),
        ]

    def __str__(self) -> str:
        return f"Card({self.id})"

    def apply_rating(self, rating: str) -> None:
        """Apply Anki-style rating: again/hard/good/easy.

        This is a simplified SRS tuned for practice, not a full SM-2 implementation.
        """

        now = timezone.now()
        r = (rating or "").strip().lower()
        if r not in {c for c, _ in Card.Rating.choices}:
            raise ValueError("Invalid rating")

        self.last_reviewed = now
        self.last_rating = r

        # map to SM-2-ish quality: again=0, hard=3, good=4, easy=5
        quality = {"again": 0, "hard": 3, "good": 4, "easy": 5}[r]

        if r == Card.Rating.AGAIN:
            self.lapses += 1
            self.repetitions = 0
            self.interval_days = 0
            self.ease_factor = max(1.3, self.ease_factor - 0.2)
            self.due_at = now + timedelta(minutes=10)
            return

        # update ease_factor
        ef = self.ease_factor
        ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        self.ease_factor = min(2.8, max(1.3, ef))

        self.repetitions += 1
        if self.repetitions == 1:
            self.interval_days = 1
        elif self.repetitions == 2:
            self.interval_days = 3 if r != Card.Rating.EASY else 4
        else:
            multiplier = 1.3 if r == Card.Rating.HARD else (self.ease_factor if r == Card.Rating.GOOD else self.ease_factor * 1.3)
            self.interval_days = max(1, int(round(self.interval_days * multiplier)))

        self.due_at = now + timedelta(days=self.interval_days)
