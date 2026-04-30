"""Celery tasks for OCR processing."""
from __future__ import annotations

import logging

from celery import shared_task
from django.db import close_old_connections
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60, name="ocr.run_ocr")
def run_ocr_task(self, paper_pk: int) -> None:
    """Process OCR for a QuestionPaper. Retries up to 3 times on transient failures."""
    close_old_connections()
    try:
        from .models import QuestionPaper
        from .parser import parse_questions
        from .processor import process_paper

        paper = QuestionPaper.objects.get(pk=paper_pk)
        extracted_text = process_paper(paper.file.path)
        parsed = parse_questions(extracted_text)

        paper.extracted_text = extracted_text
        paper.parsed_questions = parsed
        paper.status = QuestionPaper.Status.COMPLETED
        paper.processed_at = timezone.now()
        paper.save(update_fields=["extracted_text", "parsed_questions", "status", "processed_at"])

        logger.info("OCR task completed for paper %d — %d questions", paper_pk, len(parsed))

    except Exception as exc:
        logger.exception("OCR task failed for paper %d: %s", paper_pk, exc)
        try:
            from .models import QuestionPaper
            QuestionPaper.objects.filter(pk=paper_pk).update(
                status=QuestionPaper.Status.FAILED,
                error_message=str(exc),
            )
        except Exception:
            pass
        raise self.retry(exc=exc)

    finally:
        close_old_connections()
