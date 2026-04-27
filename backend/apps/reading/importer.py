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


def import_reading_csv(file_bytes: bytes) -> ReadingImportResult:
    """Import reading passages + questions from a single CSV.

    See docs/imports/reading_import.md for the schema.

    Raises ReadingImportError with a human-readable message when validation fails.
    """

    decoded = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))
    if not reader.fieldnames:
        raise ReadingImportError("CSV has no headers.")

    normalized = {h.strip().lower(): h for h in reader.fieldnames if h}
    required = [
        "passage_title",
        "passage_type",
        "jlpt_level",
        "text_jp",
        "question",
        "option_a",
        "option_b",
        "option_c",
        "option_d",
        "answer",
    ]
    missing = [h for h in required if h not in normalized]
    if missing:
        raise ReadingImportError(f"Missing required headers: {', '.join(missing)}")

    def get(raw: dict[str, str], name: str) -> str:
        return (raw.get(normalized.get(name, name)) or "").strip()

    created_passages = 0
    created_questions = 0

    with transaction.atomic():
        cache: dict[tuple[str, str, str], ReadingPassage] = {}

        for idx, raw in enumerate(reader, start=2):
            title = get(raw, "passage_title")
            ptype = get(raw, "passage_type")
            level = get(raw, "jlpt_level")

            if not title:
                raise ReadingImportError(f"Missing passage_title at line {idx}.")
            if ptype not in {c for c, _ in ReadingPassage.PassageType.choices}:
                raise ReadingImportError(f"Invalid passage_type at line {idx}.")
            if level not in {c for c, _ in JLPTLevel.choices}:
                raise ReadingImportError(f"Invalid jlpt_level at line {idx}.")

            text_jp = get(raw, "text_jp")
            if not text_jp:
                raise ReadingImportError(f"Missing text_jp at line {idx}.")

            key = (title, ptype, level)
            passage = cache.get(key)
            if not passage:
                tags_raw = get(raw, "tags")
                tags = [t.strip() for t in tags_raw.split(";") if t.strip()] if tags_raw else []

                passage, created = ReadingPassage.objects.get_or_create(
                    title=title,
                    passage_type=ptype,
                    jlpt_level=level,
                    defaults={
                        "text_jp": text_jp,
                        "text_en": get(raw, "text_en"),
                        "source": get(raw, "source"),
                        "tags": tags,
                    },
                )

                # If already exists, keep existing unless new values are provided.
                if not created:
                    passage.text_jp = text_jp or passage.text_jp
                    passage.text_en = get(raw, "text_en") or passage.text_en
                    passage.source = get(raw, "source") or passage.source
                    if tags:
                        passage.tags = tags
                    passage.save()

                cache[key] = passage
                created_passages += 1 if created else 0

            ans = get(raw, "answer").upper()
            if ans not in {"A", "B", "C", "D"}:
                raise ReadingImportError(f"Invalid answer at line {idx} (must be A-D).")

            order_str = get(raw, "order")
            try:
                order = int(order_str) if order_str else 0
            except ValueError:
                raise ReadingImportError(f"Invalid order at line {idx}.")

            q_text = get(raw, "question")
            if not q_text:
                raise ReadingImportError(f"Missing question at line {idx}.")

            qtype = get(raw, "question_type") or ReadingQuestion.QuestionType.OTHER
            if qtype not in {c for c, _ in ReadingQuestion.QuestionType.choices}:
                raise ReadingImportError(f"Invalid question_type at line {idx}.")

            ReadingQuestion.objects.create(
                passage=passage,
                order=order,
                question_type=qtype,
                question=q_text,
                option_a=get(raw, "option_a"),
                option_b=get(raw, "option_b"),
                option_c=get(raw, "option_c"),
                option_d=get(raw, "option_d"),
                answer=ans,
                explanation=get(raw, "explanation"),
            )
            created_questions += 1

    return ReadingImportResult(created_passages=created_passages, created_questions=created_questions)
