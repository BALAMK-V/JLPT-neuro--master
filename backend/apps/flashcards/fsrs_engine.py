"""FSRS-4.5 / 6.x spaced repetition engine wrapper.

Maps our Card model fields to the fsrs library objects and back.
Falls back gracefully to SM-2 if fsrs is not installed.
"""
from __future__ import annotations

from datetime import timezone as dt_timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import Card


def _build_fsrs_card(card: "Card"):
    """Reconstruct an fsrs.Card from our Card model state."""
    from fsrs import Card as FCard, State

    state_map = {
        "learning": State.Learning,
        "review": State.Review,
        "relearning": State.Relearning,
    }
    state = state_map.get(card.fsrs_state or "learning", State.Learning)

    last_review = card.last_reviewed
    if last_review is not None and last_review.tzinfo is None:
        last_review = last_review.replace(tzinfo=dt_timezone.utc)

    fc = FCard(
        stability=card.fsrs_stability,
        difficulty=card.fsrs_difficulty,
        state=state,
        last_review=last_review,
    )
    return fc


def apply_fsrs_rating(card: "Card", rating: str) -> None:
    """Apply an FSRS review and write results back to card fields in-place."""
    try:
        from fsrs import Rating, Scheduler, State
    except ImportError:
        card.apply_sm2_rating(rating)
        return

    from django.utils import timezone

    rating_map = {
        "again": Rating.Again,
        "hard": Rating.Hard,
        "good": Rating.Good,
        "easy": Rating.Easy,
    }
    fsrs_rating = rating_map.get(rating)
    if fsrs_rating is None:
        raise ValueError(f"Invalid rating: {rating}")

    scheduler = Scheduler()
    fc = _build_fsrs_card(card)
    now = timezone.now()

    updated, _log = scheduler.review_card(fc, fsrs_rating, now)

    card.fsrs_stability = updated.stability
    card.fsrs_difficulty = updated.difficulty
    card.repetitions += 1 if rating != "again" else 0
    card.lapses = card.lapses + (1 if rating == "again" else 0)
    card.last_reviewed = now
    card.last_rating = rating

    state_names = {
        State.Learning: "learning",
        State.Review: "review",
        State.Relearning: "relearning",
    }
    card.fsrs_state = state_names.get(updated.state, "learning")

    card.due_at = updated.due

    # Approximate interval_days from the scheduled due date
    delta = updated.due - now
    card.interval_days = max(0, delta.days)
