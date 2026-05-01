from __future__ import annotations

import csv
import io
from dataclasses import dataclass

from django.db import transaction

from apps.content.models import JLPTLevel

from .models import ReadingPassage, ReadingQuestion


@dataclass(frozen=True)
class ReadingImportResult:
    created_passages: int
    created_questions: int


class ReadingImportError(ValueError):
    pass


def _import_reading_rows(rows: list[dict]) -> ReadingImportResult:
    """Import reading passages + questions from pre-parsed lowercase-keyed dicts."""
    if not rows:
        raise ReadingImportError("File contains no data rows.")

    required = [
        "passage_title", "passage_type", "jlpt_level", "text_jp",
        "question", "option_a", "option_b", "option_c", "option_d", "answer",
    ]
    missing = [h for h in required if h not in rows[0]]
    if missing:
        raise ReadingImportError(f"Missing required columns: {', '.join(missing)}")

    valid_levels = {c for c, _ in JLPTLevel.choices}

    created_passages = 0
    created_questions = 0

    with transaction.atomic():
        cache: dict[tuple[str, str, str], ReadingPassage] = {}

        for idx, raw in enumerate(rows, start=2):
            title = (raw.get("passage_title") or "").strip()
            ptype = (raw.get("passage_type") or "").strip()
            level = (raw.get("jlpt_level") or "").strip()

            if not title:
                raise ReadingImportError(f"Missing passage_title at row {idx}.")
            if ptype not in {c for c, _ in ReadingPassage.PassageType.choices}:
                raise ReadingImportError(f"Invalid passage_type at row {idx}.")
            if level not in valid_levels:
                raise ReadingImportError(f"Invalid jlpt_level at row {idx}.")

            text_jp = (raw.get("text_jp") or "").strip()
            if not text_jp:
                raise ReadingImportError(f"Missing text_jp at row {idx}.")

            key = (title, ptype, level)
            passage = cache.get(key)
            if not passage:
                tags_raw = (raw.get("tags") or "").strip()
                tags = [t.strip() for t in tags_raw.split(";") if t.strip()] if tags_raw else []

                passage, created = ReadingPassage.objects.get_or_create(
                    title=title,
                    passage_type=ptype,
                    jlpt_level=level,
                    defaults={
                        "text_jp": text_jp,
                        "text_en": (raw.get("text_en") or "").strip(),
                        "source": (raw.get("source") or "").strip(),
                        "tags": tags,
                    },
                )

                if not created:
                    passage.text_jp = text_jp or passage.text_jp
                    passage.text_en = (raw.get("text_en") or "").strip() or passage.text_en
                    passage.source = (raw.get("source") or "").strip() or passage.source
                    if tags:
                        passage.tags = tags
                    passage.save()

                cache[key] = passage
                created_passages += 1 if created else 0

            ans = (raw.get("answer") or "").strip().upper()
            if ans not in {"A", "B", "C", "D"}:
                raise ReadingImportError(f"Invalid answer at row {idx} (must be A-D).")

            order_str = (raw.get("order") or "0").strip()
            try:
                order = int(order_str) if order_str else 0
            except ValueError:
                raise ReadingImportError(f"Invalid order at row {idx}.")

            q_text = (raw.get("question") or "").strip()
            if not q_text:
                raise ReadingImportError(f"Missing question at row {idx}.")

            qtype = (raw.get("question_type") or ReadingQuestion.QuestionType.OTHER).strip()
            if qtype not in {c for c, _ in ReadingQuestion.QuestionType.choices}:
                raise ReadingImportError(f"Invalid question_type at row {idx}.")

            ReadingQuestion.objects.create(
                passage=passage,
                order=order,
                question_type=qtype,
                question=q_text,
                option_a=(raw.get("option_a") or "").strip(),
                option_b=(raw.get("option_b") or "").strip(),
                option_c=(raw.get("option_c") or "").strip(),
                option_d=(raw.get("option_d") or "").strip(),
                answer=ans,
                explanation=(raw.get("explanation") or "").strip(),
            )
            created_questions += 1

    return ReadingImportResult(created_passages=created_passages, created_questions=created_questions)


def import_reading_csv(file_bytes: bytes) -> ReadingImportResult:
    """Import reading passages + questions from CSV bytes (kept for backwards-compatibility)."""
    decoded = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))
    if not reader.fieldnames:
        raise ReadingImportError("CSV has no headers.")
    rows = [{k.strip().lower(): (v or "").strip() for k, v in row.items()} for row in reader]
    return _import_reading_rows(rows)
