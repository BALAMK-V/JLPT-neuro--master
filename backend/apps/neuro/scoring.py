from __future__ import annotations

from typing import Any


TRAITS = ["focus", "attention_span", "memory_retention", "distraction", "consistency", "sensory_preference", "structure"]

RESULT_COPY = {
    "balanced": {
        "title": "Balanced learning pattern",
        "explanation": "Your answers suggest a balanced learning profile with steady attention and flexible routines.",
        "strengths": ["Flexible study flow", "Balanced attention", "Good tolerance for varied practice"],
        "weaknesses": ["May still benefit from intentional review timing"],
        "recommended_learning_style": "Use standard 20-30 minute sessions, mixed question types, and spaced review.",
    },
    "quick_reset": {
        "title": "Quick Reset learning pattern",
        "explanation": "Your answers suggest high stimulation needs and restlessness during longer study blocks.",
        "strengths": ["Fast starts", "High energy", "Strong response to game-like feedback"],
        "weaknesses": ["Long tasks may feel hard to sit through", "Notifications can become distracting"],
        "recommended_learning_style": "Use short 8-12 minute sessions, visible timers, movement breaks, and compact goals.",
    },
    "focus_support": {
        "title": "Focus Support learning pattern",
        "explanation": "Your answers suggest attention drift, re-reading loops, and difficulty holding study context.",
        "strengths": ["Can learn deeply with cues", "Benefits from visual anchors", "Often strong at pattern spotting"],
        "weaknesses": ["Context may fade quickly", "Task completion can need external structure"],
        "recommended_learning_style": "Use visual cues, checklists, short retrieval practice, and gentle reminders.",
    },
    "momentum_support": {
        "title": "Momentum Support learning pattern",
        "explanation": "Your answers show both attention drift and high stimulation needs.",
        "strengths": ["Bursts of deep interest", "Responsive to novelty", "Good momentum when tasks are clear"],
        "weaknesses": ["Consistency can swing", "Large lessons may feel noisy"],
        "recommended_learning_style": "Use 8-10 minute missions, low-friction review, visual progress, and frequent reset points.",
    },
    "calm_structure": {
        "title": "Calm Structure learning pattern",
        "explanation": "Your answers suggest a preference for predictability, reduced sensory load, and structured learning.",
        "strengths": ["Routine-friendly", "Detail-focused", "Strong with predictable systems"],
        "weaknesses": ["Too much information at once can feel overwhelming", "Abrupt changes may slow progress"],
        "recommended_learning_style": "Use predictable lesson order, low-motion UI, clear categories, and fewer simultaneous choices.",
    },
}


def normalize_scores(raw_scores: dict[str, float], trait_max_scores: dict[str, float]) -> dict[str, int]:
    normalized = {}
    for trait in TRAITS:
        max_score = trait_max_scores.get(trait, 0)
        if max_score <= 0:
            normalized[trait] = 0
        else:
            normalized[trait] = min(100, max(0, round((raw_scores.get(trait, 0) / max_score) * 100)))
    return normalized


def classify(trait_scores: dict[str, int]) -> str:
    distraction = trait_scores.get("distraction", 0)
    attention_gap = 100 - trait_scores.get("attention_span", 0)
    consistency_gap = 100 - trait_scores.get("consistency", 0)
    sensory = trait_scores.get("sensory_preference", 0)
    structure = trait_scores.get("structure", 0)
    focus = trait_scores.get("focus", 0)

    calm_structure_signal = (sensory + structure) / 2
    focus_support_signal = (distraction + attention_gap + consistency_gap) / 3
    quick_reset_signal = max(distraction, focus)

    if calm_structure_signal >= 68 and sensory >= 62:
        return "calm_structure"
    if focus_support_signal >= 66 and quick_reset_signal >= 72:
        return "momentum_support"
    if quick_reset_signal >= 72:
        return "quick_reset"
    if focus_support_signal >= 62:
        return "focus_support"
    return "balanced"


def profile_adjustments(result_type: str) -> dict[str, Any]:
    if result_type == "calm_structure":
        return {
            "learning_type": "calm_structure",
            "session_minutes_preference": 12,
            "reminder_interval_minutes": 35,
            "ui_prefs": {"reduced_motion": True, "complexity": "low", "learning_alias": "calm_structure"},
        }
    if result_type == "quick_reset":
        return {
            "learning_type": "focus_support",
            "session_minutes_preference": 8,
            "reminder_interval_minutes": 15,
            "ui_prefs": {"reduced_motion": False, "complexity": "medium", "learning_alias": "quick_reset"},
        }
    if result_type in {"focus_support", "momentum_support"}:
        return {
            "learning_type": "focus_support",
            "session_minutes_preference": 10,
            "reminder_interval_minutes": 18,
            "ui_prefs": {"reduced_motion": False, "complexity": "medium", "learning_alias": "focus_support"},
        }
    return {
        "learning_type": "balanced",
        "session_minutes_preference": 25,
        "reminder_interval_minutes": 25,
        "ui_prefs": {"reduced_motion": False, "complexity": "standard", "learning_alias": "balanced"},
    }


def build_summary(result_type: str, trait_scores: dict[str, int]) -> dict[str, Any]:
    return {**RESULT_COPY[result_type], "trait_scores": trait_scores}
