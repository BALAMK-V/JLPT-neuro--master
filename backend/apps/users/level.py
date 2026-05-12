"""Compute a player level from accumulated study activity."""
from __future__ import annotations


def compute_player_level(user) -> dict:  # type: ignore[no-untyped-def]
    """Return level info dict for *user* based on study activity."""
    from apps.tracking.models import UserProgress, Session
    from apps.flashcards.models import Card
    from apps.assessment.models import Test

    xp = 0

    # Correct reviews from UserProgress
    correct = (
        UserProgress.objects.filter(user=user)
        .values_list("correct_attempts", flat=True)
    )
    xp += sum(correct) * 5

    # Sessions
    session_count = Session.objects.filter(user=user).count()
    xp += session_count * 20

    # Flash card reviews (repetitions as proxy for reviews done)
    flash_reps = (
        Card.objects.filter(deck__user=user)
        .values_list("repetitions", flat=True)
    )
    xp += sum(flash_reps) * 5

    # Neuro assessment bonus
    try:
        user.neuro_profile  # noqa: B018
        xp += 100
    except Exception:
        pass

    # Test completions — count UserExamSession completions as proxy
    try:
        from apps.jlpt_exam.models import UserExamSession
        completed_exams = UserExamSession.objects.filter(user=user, status="completed").count()
        xp += completed_exams * 50
    except Exception:
        pass

    # Derive level (1–100) from XP thresholds (quadratic: level n costs n*100 XP)
    # Total XP to reach level n = sum(k*100 for k in 1..n) = n*(n+1)/2 * 100
    level = 1
    while level < 100:
        xp_needed = level * (level + 1) // 2 * 100
        if xp < xp_needed:
            break
        level += 1

    prev_xp = (level - 1) * level // 2 * 100
    next_xp = level * (level + 1) // 2 * 100

    if level <= 10:
        title = "Genin"
    elif level <= 25:
        title = "Chunin"
    elif level <= 45:
        title = "Jonin"
    elif level <= 70:
        title = "Sensei"
    else:
        title = "Master"

    return {
        "level": level,
        "title": title,
        "xp": xp,
        "xp_in_level": max(0, xp - prev_xp),
        "next_xp": next_xp - prev_xp,
    }
