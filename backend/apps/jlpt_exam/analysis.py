"""
JLPT exam analysis engine.
Computes section scores, identifies weak areas, and generates study suggestions.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from django.db.models import QuerySet

PASS_THRESHOLD = 60.0

_WEAK_AREA_LABELS: dict[str, str] = {
    "vocabulary": "Vocabulary confusion — difficulty distinguishing similar words",
    "grammar": "Grammar pattern mistakes — incorrect usage of grammar structures",
    "reading": "Reading comprehension gaps — difficulty inferring meaning from passages",
    "listening": "Listening detail missed — struggling to catch key spoken information",
}

_SUGGESTIONS: dict[str, list[str]] = {
    "vocabulary": [
        "Revise N{level} vocabulary list, focusing on similar-sounding words",
        "Use spaced-repetition flashcards for vocabulary review",
        "Read example sentences to build word context memory",
    ],
    "grammar": [
        "Study N{level} grammar patterns: 〜ている, 〜ように, 〜させる",
        "Complete grammar fill-in-the-blank exercises daily",
        "Review grammar explanation cards for common N{level} structures",
    ],
    "reading": [
        "Read short Japanese articles (NHK Web Easy) every day",
        "Practice timed reading comprehension with N{level} passages",
        "Focus on identifying the main idea before scanning for details",
    ],
    "listening": [
        "Practice listening daily with 5–10 minute Japanese audio clips",
        "Do shadowing exercises to improve processing speed",
        "Review N{level} listening question patterns and traps",
    ],
}


def compute_section_scores(answers: "QuerySet") -> dict[str, dict[str, Any]]:
    """Return per-section totals, correct counts, and percentage from an answers queryset."""
    buckets: dict[str, dict[str, int]] = {}

    for answer in answers.select_related("question"):
        sec = answer.question.section
        if sec not in buckets:
            buckets[sec] = {"total": 0, "correct": 0}
        buckets[sec]["total"] += 1
        if answer.is_correct:
            buckets[sec]["correct"] += 1

    result: dict[str, dict[str, Any]] = {}
    for sec, counts in buckets.items():
        total = counts["total"]
        correct = counts["correct"]
        result[sec] = {
            "total": total,
            "correct": correct,
            "percentage": round(correct / total * 100, 1) if total > 0 else 0.0,
        }
    return result


def identify_weak_areas(section_scores: dict[str, dict[str, Any]]) -> list[str]:
    """Return human-readable weak area descriptions for sections below PASS_THRESHOLD."""
    weak: list[str] = []
    for section, data in section_scores.items():
        if data["percentage"] < PASS_THRESHOLD:
            label = _WEAK_AREA_LABELS.get(
                section, f"{section.title()} performance below passing threshold"
            )
            weak.append(label)
    return weak


def generate_suggestions(section_scores: dict[str, dict[str, Any]], level: str) -> list[str]:
    """
    Generate personalised study suggestions based on section performance.
    Sections below 40 % get two suggestions; 40–60 % get one.
    """
    level_num = level.upper().replace("N", "")
    suggestions: list[str] = []

    for section, data in section_scores.items():
        pct = data["percentage"]
        templates = _SUGGESTIONS.get(section, [])
        count = 2 if pct < 40.0 else (1 if pct < PASS_THRESHOLD else 0)
        for tmpl in templates[:count]:
            suggestions.append(tmpl.format(level=level_num))

    return suggestions


def determine_pass(section_scores: dict[str, dict[str, Any]]) -> bool:
    """
    Simplified JLPT pass rule: every section must be >= 60 % AND overall >= 60 %.
    """
    if not section_scores:
        return False
    all_sections_pass = all(d["percentage"] >= PASS_THRESHOLD for d in section_scores.values())
    total_correct = sum(d["correct"] for d in section_scores.values())
    total_qs = sum(d["total"] for d in section_scores.values())
    overall_pct = (total_correct / total_qs * 100) if total_qs > 0 else 0.0
    return all_sections_pass and overall_pct >= PASS_THRESHOLD


def build_result_data(
    session: Any,  # UserExamSession
) -> dict[str, Any]:
    """
    Central helper: given a submitted UserExamSession, compute and return
    all fields needed to populate an ExamResult record.
    """
    answers = session.answers.all()
    section_scores = compute_section_scores(answers)

    total = answers.count()
    correct = answers.filter(is_correct=True).count()
    score_pct = round(correct / total * 100, 1) if total > 0 else 0.0

    time_taken = sum(a.time_taken_seconds for a in answers)

    level = session.exam.level
    weak_areas = identify_weak_areas(section_scores)
    suggestions = generate_suggestions(section_scores, level)
    passed = determine_pass(section_scores)

    return {
        "total_questions": total,
        "correct_answers": correct,
        "score_percentage": score_pct,
        "time_taken_seconds": time_taken,
        "section_scores": section_scores,
        "weak_areas": weak_areas,
        "study_suggestions": suggestions,
        "passed": passed,
    }
