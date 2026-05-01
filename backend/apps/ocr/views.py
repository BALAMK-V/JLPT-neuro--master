from __future__ import annotations

import logging
import threading

from django.conf import settings
from django.db import close_old_connections
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsManagementUser

from apps.jlpt_exam.models import ExamOption, ExamQuestion, JLPTExam

from .ai_cleaner import ai_clean_questions
from .models import QuestionPaper
from .parser import parse_questions
from .processor import process_paper
from .serializers import (
    ImportConfirmSerializer,
    PaperUploadSerializer,
    QuestionPaperSerializer,
    UpdateParsedQuestionsSerializer,
)

logger = logging.getLogger(__name__)


# ─── Background OCR worker ────────────────────────────────────────────────────

def _run_ocr_background(paper_pk: int) -> None:
    """
    Run OCR (and optional AI cleaning) in a daemon thread.
    The upload HTTP request returns immediately; this updates the DB when done.
    """
    close_old_connections()
    try:
        paper = QuestionPaper.objects.get(pk=paper_pk)
        extracted_text = process_paper(paper.file.path)
        parsed = parse_questions(extracted_text)

        paper.extracted_text = extracted_text
        paper.parsed_questions = parsed
        paper.status = QuestionPaper.Status.COMPLETED
        paper.processed_at = timezone.now()
        paper.save(update_fields=["extracted_text", "parsed_questions", "status", "processed_at"])

        logger.info("OCR completed for paper %d — %d questions (regex)", paper_pk, len(parsed))

    except QuestionPaper.DoesNotExist:
        logger.error("OCR background task: paper %d not found", paper_pk)

    except Exception as exc:
        logger.exception("OCR failed for paper %d: %s", paper_pk, exc)
        try:
            QuestionPaper.objects.filter(pk=paper_pk).update(
                status=QuestionPaper.Status.FAILED,
                error_message=str(exc),
            )
        except Exception:
            pass

    finally:
        close_old_connections()


# ─── Upload ───────────────────────────────────────────────────────────────────

class QuestionPaperUploadView(APIView):
    """
    POST /api/ocr/upload/
    Accepts a file + level. Returns immediately with status=processing.
    OCR runs in a background thread — poll GET /api/ocr/papers/<id>/ for status.
    """

    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsManagementUser]

    def post(self, request: Request) -> Response:
        serializer = PaperUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]
        level = serializer.validated_data["level"]
        name = uploaded_file.name.lower()
        file_type = QuestionPaper.FileType.PDF if name.endswith(".pdf") else QuestionPaper.FileType.IMAGE

        paper = QuestionPaper.objects.create(
            uploaded_by=request.user,
            file=uploaded_file,
            file_type=file_type,
            original_filename=uploaded_file.name,
            level=level,
            status=QuestionPaper.Status.PROCESSING,
        )

        try:
            from .tasks import run_ocr_task
            run_ocr_task.delay(paper.pk)
        except Exception:
            thread = threading.Thread(target=_run_ocr_background, args=(paper.pk,), daemon=True)
            thread.start()

        return Response(QuestionPaperSerializer(paper).data, status=status.HTTP_201_CREATED)


# ─── List / Detail ────────────────────────────────────────────────────────────

class QuestionPaperListView(APIView):
    """GET /api/ocr/papers/ — list papers for the current user."""

    permission_classes = [IsManagementUser]

    def get(self, request: Request) -> Response:
        papers = QuestionPaper.objects.filter(uploaded_by=request.user)
        return Response(QuestionPaperSerializer(papers, many=True).data)


class QuestionPaperDetailView(APIView):
    """
    GET  /api/ocr/papers/<pk>/ — fetch paper (poll here for OCR status).
    """

    permission_classes = [IsManagementUser]

    def get(self, request: Request, pk: int) -> Response:
        try:
            paper = QuestionPaper.objects.get(pk=pk, uploaded_by=request.user)
        except QuestionPaper.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(QuestionPaperSerializer(paper).data)


# ─── AI Parse ─────────────────────────────────────────────────────────────────

class AIParsePaperView(APIView):
    """
    POST /api/ocr/papers/<pk>/ai-parse/

    Sends the extracted OCR text to Claude and stores the cleaned questions
    in ai_parsed_questions.  Requires ANTHROPIC_API_KEY in .env.
    """

    permission_classes = [IsManagementUser]

    def post(self, request: Request, pk: int) -> Response:
        if not getattr(settings, "ANTHROPIC_API_KEY", ""):
            return Response(
                {"detail": "ANTHROPIC_API_KEY is not configured. Add it to your .env file."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            paper = QuestionPaper.objects.get(pk=pk, uploaded_by=request.user)
        except QuestionPaper.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if paper.status != QuestionPaper.Status.COMPLETED:
            return Response(
                {"detail": "OCR must complete before running AI parse."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not paper.extracted_text:
            return Response(
                {"detail": "No extracted text to parse."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Run synchronously — Claude Haiku responds in ~5–15 sec for a full paper
        try:
            ai_questions = ai_clean_questions(paper.extracted_text, level=paper.level)
        except Exception as exc:
            logger.exception("AI parse failed for paper %d: %s", pk, exc)
            return Response(
                {"detail": f"AI parsing failed: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        paper.ai_parsed_questions = ai_questions
        paper.save(update_fields=["ai_parsed_questions"])

        return Response(
            {
                "questions_found": len(ai_questions),
                "ai_parsed_questions": ai_questions,
            }
        )


# ─── Manual edit ──────────────────────────────────────────────────────────────

class UpdateParsedQuestionsView(APIView):
    """
    PATCH /api/ocr/papers/<pk>/questions/

    Replaces parsed_questions with the user-edited list.
    This is the "save edits" endpoint used by the QuestionEditor UI.
    """

    permission_classes = [IsManagementUser]

    def patch(self, request: Request, pk: int) -> Response:
        try:
            paper = QuestionPaper.objects.get(pk=pk, uploaded_by=request.user)
        except QuestionPaper.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = UpdateParsedQuestionsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        questions = serializer.validated_data["questions"]
        # Re-number orders sequentially
        for i, q in enumerate(questions, start=1):
            q["order"] = i

        paper.parsed_questions = questions
        paper.save(update_fields=["parsed_questions"])

        return Response(
            {"saved": len(questions), "parsed_questions": paper.parsed_questions}
        )


# ─── Import ───────────────────────────────────────────────────────────────────

class ImportParsedQuestionsView(APIView):
    """
    POST /api/ocr/import/
    Import parsed_questions from a completed paper into a JLPTExam.
    Creates a new exam when exam_id is omitted.
    """

    permission_classes = [IsManagementUser]

    def post(self, request: Request) -> Response:
        serializer = ImportConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            paper = QuestionPaper.objects.get(pk=data["paper_id"], uploaded_by=request.user)
        except QuestionPaper.DoesNotExist:
            return Response({"detail": "Paper not found."}, status=status.HTTP_404_NOT_FOUND)

        if paper.status != QuestionPaper.Status.COMPLETED:
            return Response(
                {"detail": f"Paper OCR status is '{paper.status}', not completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parsed: list[dict] = paper.parsed_questions or []
        indices = data.get("question_indices") or []
        if indices:
            parsed = [parsed[i] for i in indices if i < len(parsed)]

        if not parsed:
            return Response({"detail": "No questions to import."}, status=status.HTTP_400_BAD_REQUEST)

        exam_id = data.get("exam_id")
        if exam_id:
            try:
                exam = JLPTExam.objects.get(pk=exam_id)
            except JLPTExam.DoesNotExist:
                return Response({"detail": "Exam not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            title = data.get("exam_title") or f"Imported from {paper.original_filename}"
            exam = JLPTExam.objects.create(
                level=paper.level,
                title=title,
                created_by=request.user,
                is_published=False,
            )

        next_order = (exam.questions.order_by("-order").first().order + 1) if exam.questions.exists() else 1
        option_labels = ["A", "B", "C", "D"]
        created_count = 0

        for i, q_data in enumerate(parsed):
            question_text = q_data.get("question_text", "").strip()
            if not question_text:
                continue

            question = ExamQuestion.objects.create(
                exam=exam,
                order=next_order + i,
                section=q_data.get("section", "vocabulary"),
                question_type=q_data.get("question_type", "multiple_choice"),
                question_text=question_text,
            )

            for j, opt in enumerate(q_data.get("options", [])):
                ExamOption.objects.create(
                    question=question,
                    label=opt.get("label", option_labels[j] if j < len(option_labels) else str(j + 1)),
                    text=opt.get("text", ""),
                    is_correct=(j == 0),  # first option marked correct by default; edit in admin
                )
            created_count += 1

        return Response(
            {"exam_id": exam.pk, "exam_title": exam.title, "questions_imported": created_count},
            status=status.HTTP_201_CREATED,
        )
