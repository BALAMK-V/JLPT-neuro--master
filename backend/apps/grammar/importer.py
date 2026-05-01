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


def _import_grammar_rows(rows: list[dict]) -> GrammarImportResult:
    """Import grammar questions from pre-parsed lowercase-keyed dicts."""
    if not rows:
        raise GrammarImportError("File contains no data rows.")

    required = ["prompt", "option_a", "option_b", "option_c", "option_d", "answer"]
    missing = [h for h in required if h not in rows[0]]
    if missing:
        raise GrammarImportError(f"Missing required columns: {', '.join(missing)}")

    valid_sections = {c for c, _ in GrammarQuestion.Section.choices}
    valid_types = {c for c, _ in GrammarQuestion.QuestionType.choices}
    valid_levels = {c for c, _ in JLPTLevel.choices}

    created = 0
    with transaction.atomic():
        for idx, raw in enumerate(rows, start=2):
            ans = (raw.get("answer") or "").strip().upper()
            if ans not in {"A", "B", "C", "D"}:
                raise GrammarImportError(f"Invalid answer at row {idx} (must be A-D).")

            level = (raw.get("jlpt_level") or JLPTLevel.N2).strip()
            if level not in valid_levels:
                raise GrammarImportError(f"Invalid jlpt_level at row {idx}.")

            section = (raw.get("section") or GrammarQuestion.Section.OTHER).strip()
            if section not in valid_sections:
                raise GrammarImportError(f"Invalid section at row {idx}.")

            qtype = (raw.get("question_type") or GrammarQuestion.QuestionType.CHOOSE).strip()
            if qtype not in valid_types:
                raise GrammarImportError(f"Invalid question_type at row {idx}.")

            tags_raw = (raw.get("tags") or "").strip()
            tags = [t.strip() for t in tags_raw.split(";") if t.strip()] if tags_raw else []

            prompt_text = (raw.get("prompt") or "").strip()
            _, was_created = GrammarQuestion.objects.update_or_create(
                jlpt_level=level,
                prompt=prompt_text,
                defaults=dict(
                    section=section,
                    question_type=qtype,
                    context_text_jp=(raw.get("context_text_jp") or "").strip(),
                    option_a=(raw.get("option_a") or "").strip(),
                    option_b=(raw.get("option_b") or "").strip(),
                    option_c=(raw.get("option_c") or "").strip(),
                    option_d=(raw.get("option_d") or "").strip(),
                    answer=ans,
                    explanation=(raw.get("explanation") or "").strip(),
                    tags=tags,
                ),
            )
            if was_created:
                created += 1

    return GrammarImportResult(created=created)


def import_grammar_csv(file_bytes: bytes) -> GrammarImportResult:
    """Import grammar questions from CSV bytes (kept for backwards-compatibility)."""
    decoded = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))
    if not reader.fieldnames:
        raise GrammarImportError("CSV has no headers.")
    rows = [{k.strip().lower(): (v or "").strip() for k, v in row.items()} for row in reader]
    return _import_grammar_rows(rows)
