from __future__ import annotations

import csv
import io
from dataclasses import dataclass

from django.db import transaction

from apps.content.models import JLPTLevel

from .models import GrammarQuestion


@dataclass(frozen=True)
class GrammarImportResult:
    created: int


class GrammarImportError(ValueError):
    pass


def import_grammar_csv(file_bytes: bytes) -> GrammarImportResult:
    """Import grammar questions from a single CSV.

    Raises GrammarImportError with a human-readable message when validation fails.
    """

    decoded = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))
    if not reader.fieldnames:
        raise GrammarImportError("CSV has no headers.")

    normalized = {h.strip().lower(): h for h in reader.fieldnames if h}
    required = ["prompt", "option_a", "option_b", "option_c", "option_d", "answer"]
    missing = [h for h in required if h not in normalized]
    if missing:
        raise GrammarImportError(f"Missing required headers: {', '.join(missing)}")

    def get(raw: dict[str, str], name: str) -> str:
        return (raw.get(normalized.get(name, name)) or "").strip()

    valid_sections = {c for c, _ in GrammarQuestion.Section.choices}
    valid_types = {c for c, _ in GrammarQuestion.QuestionType.choices}
    valid_levels = {c for c, _ in JLPTLevel.choices}

    created = 0
    with transaction.atomic():
        for idx, raw in enumerate(reader, start=2):
            ans = get(raw, "answer").upper()
            if ans not in {"A", "B", "C", "D"}:
                raise GrammarImportError(f"Invalid answer at line {idx} (must be A-D).")

            level = get(raw, "jlpt_level") or JLPTLevel.N2
            if level not in valid_levels:
                raise GrammarImportError(f"Invalid jlpt_level at line {idx}.")

            section = get(raw, "section") or GrammarQuestion.Section.OTHER
            if section not in valid_sections:
                raise GrammarImportError(f"Invalid section at line {idx}.")

            qtype = get(raw, "question_type") or GrammarQuestion.QuestionType.CHOOSE
            if qtype not in valid_types:
                raise GrammarImportError(f"Invalid question_type at line {idx}.")

            tags_raw = get(raw, "tags")
            tags = [t.strip() for t in tags_raw.split(";") if t.strip()] if tags_raw else []

            prompt_text = get(raw, "prompt")
            _, was_created = GrammarQuestion.objects.update_or_create(
                jlpt_level=level,
                prompt=prompt_text,
                defaults=dict(
                    section=section,
                    question_type=qtype,
                    context_text_jp=get(raw, "context_text_jp"),
                    option_a=get(raw, "option_a"),
                    option_b=get(raw, "option_b"),
                    option_c=get(raw, "option_c"),
                    option_d=get(raw, "option_d"),
                    answer=ans,
                    explanation=get(raw, "explanation"),
                    tags=tags,
                ),
            )
            if was_created:
                created += 1

    return GrammarImportResult(created=created)

