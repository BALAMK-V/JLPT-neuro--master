from __future__ import annotations

import io
import os
import zipfile
from dataclasses import dataclass

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from rest_framework import permissions, status, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.content.models import JLPTLevel
from apps.flashcards.models import ImportLog
from apps.import_utils import ImportFileError, parse_import_file
from apps.users.permissions import IsManagementUser

from .models import ListeningQuestion
from .serializers import ListeningQuestionSerializer


class ListeningQuestionViewSet(viewsets.ModelViewSet):
    queryset = ListeningQuestion.objects.all()
    serializer_class = ListeningQuestionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["jlpt_level", "section", "question_type"]
    search_fields = ["question", "explanation", "audio_filename", "audio_text"]
    ordering_fields = ["id", "created_at", "jlpt_level", "section", "question_type"]


@dataclass(frozen=True)
class ImportRow:
    audio_file: str
    section: str
    question_type: str
    audio_text: str
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    answer: str
    explanation: str
    jlpt_level: str


def _normalize_section(raw: str) -> str:
    v = (raw or "").strip().lower()
    if not v:
        return ListeningQuestion.Section.OTHER

    mapping = {
        "課題理解": "kadai",
        "かだい": "kadai",
        "kadai": "kadai",
        "ポイント理解": "point",
        "point": "point",
        "概要理解": "gaiyo",
        "gaiyo": "gaiyo",
        "即時応答": "sokuji",
        "sokuji": "sokuji",
        "統合理解": "togo",
        "togo": "togo",
    }
    return mapping.get(raw.strip(), mapping.get(v, v))


def _normalize_question_type(raw: str) -> str:
    v = (raw or "").strip().lower()
    if not v:
        return ListeningQuestion.QuestionType.OTHER

    mapping = {
        "gist": "gist",
        "main": "gist",
        "main_idea": "gist",
        "概要": "gist",
        "detail": "detail",
        "details": "detail",
        "specific": "detail",
        "inference": "inference",
        "infer": "inference",
        "reason": "inference",
        "purpose": "purpose",
        "intent": "purpose",
        "response": "response",
        "reply": "response",
    }
    return mapping.get(raw.strip(), mapping.get(v, v))


_MAX_FILE_BYTES = 5 * 1024 * 1024   # 5 MB
_MAX_ZIP_BYTES = 50 * 1024 * 1024   # 50 MB


class ListeningImportView(APIView):
    """Multipart POST: import_file (CSV, JSON, or XLSX) + optional audio_zip

    Required columns: audio_file, question, option_a-d, answer
    Optional columns: section, question_type, audio_text, explanation, jlpt_level
    section values: kadai, point, gaiyo, sokuji, togo (or Japanese labels).
    question_type values: gist, detail, inference, purpose, response.
    """

    permission_classes = [IsManagementUser]
    parser_classes = [MultiPartParser]

    def post(self, request):  # type: ignore[no-untyped-def]
        import_file = request.FILES.get("import_file") or request.FILES.get("csv_file")
        audio_zip = request.FILES.get("audio_zip")
        if not import_file:
            return Response({"detail": "import_file is required."}, status=status.HTTP_400_BAD_REQUEST)
        if audio_zip and audio_zip.size > _MAX_ZIP_BYTES:
            return Response({"detail": "Audio ZIP too large (max 50 MB)."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            raw_rows = parse_import_file(import_file, import_file.name)
        except ImportFileError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if not raw_rows:
            return Response({"detail": "File contains no data rows."}, status=400)

        required = ["audio_file", "question", "option_a", "option_b", "option_c", "option_d", "answer"]
        missing = [h for h in required if h not in raw_rows[0]]
        if missing:
            return Response({"detail": f"Missing required columns: {', '.join(missing)}"}, status=400)

        audio_bytes = audio_zip.read() if audio_zip else None
        zip_reader = zipfile.ZipFile(io.BytesIO(audio_bytes)) if audio_bytes else None
        zip_names = set(zip_reader.namelist()) if zip_reader else set()
        zip_by_basename = {os.path.basename(n): n for n in zip_names if n and not n.endswith("/")}

        valid_sections = {c for c, _ in ListeningQuestion.Section.choices}
        valid_types = {c for c, _ in ListeningQuestion.QuestionType.choices}
        valid_levels = {c for c, _ in JLPTLevel.choices}

        rows: list[ImportRow] = []
        for idx, raw in enumerate(raw_rows, start=2):
            audio_name = (raw.get("audio_file") or "").strip()
            if audio_name and (audio_name.startswith("/") or ".." in audio_name or "\\" in audio_name):
                return Response({"detail": f"Unsafe audio_file at row {idx}."}, status=400)

            ans = (raw.get("answer") or "").strip().upper()
            if ans not in {"A", "B", "C", "D"}:
                return Response({"detail": f"Invalid answer at row {idx} (must be A-D)."}, status=400)

            level = (raw.get("jlpt_level") or JLPTLevel.N2).strip()
            if level not in valid_levels:
                return Response({"detail": f"Invalid jlpt_level at row {idx}."}, status=400)

            section = _normalize_section(raw.get("section") or "")
            if section not in valid_sections:
                return Response({"detail": f"Invalid section at row {idx}."}, status=400)

            qtype = _normalize_question_type(raw.get("question_type") or "")
            if qtype not in valid_types:
                return Response({"detail": f"Invalid question_type at row {idx}."}, status=400)

            if zip_reader and audio_name:
                if audio_name not in zip_names and audio_name not in zip_by_basename:
                    return Response({"detail": f"Audio '{audio_name}' not found in ZIP (row {idx})."}, status=400)

            rows.append(ImportRow(
                audio_file=audio_name,
                section=section,
                question_type=qtype,
                audio_text=(raw.get("audio_text") or "").strip(),
                question=(raw.get("question") or "").strip(),
                option_a=(raw.get("option_a") or "").strip(),
                option_b=(raw.get("option_b") or "").strip(),
                option_c=(raw.get("option_c") or "").strip(),
                option_d=(raw.get("option_d") or "").strip(),
                answer=ans,
                explanation=(raw.get("explanation") or "").strip(),
                jlpt_level=level,
            ))

        created = 0
        with transaction.atomic():
            for row in rows:
                obj = ListeningQuestion(
                    audio_filename=row.audio_file,
                    section=row.section,
                    question_type=row.question_type,
                    audio_text=row.audio_text,
                    question=row.question,
                    option_a=row.option_a,
                    option_b=row.option_b,
                    option_c=row.option_c,
                    option_d=row.option_d,
                    answer=row.answer,
                    explanation=row.explanation,
                    jlpt_level=row.jlpt_level,
                )
                obj.save()

                if zip_reader and row.audio_file:
                    entry_name = row.audio_file if row.audio_file in zip_names else zip_by_basename.get(row.audio_file)
                    if not entry_name:
                        return Response({"detail": f"Audio '{row.audio_file}' not found in ZIP."}, status=400)
                    data = zip_reader.read(entry_name)
                    basename = os.path.basename(entry_name)
                    saved_name = default_storage.save(f"listening/audio/{basename}", ContentFile(data))
                    obj.audio_file.name = saved_name
                    obj.save(update_fields=["audio_file"])
                elif row.audio_file:
                    existing = f"listening/audio/{row.audio_file}"
                    if default_storage.exists(existing):
                        obj.audio_file.name = existing
                        obj.save(update_fields=["audio_file"])

                created += 1

        ImportLog.objects.create(
            user=request.user, content_type=ImportLog.ContentType.LISTENING,
            filename=import_file.name, file_format=import_file.name.rsplit(".", 1)[-1].lower() if "." in import_file.name else "csv",
            rows_imported=created,
        )
        return Response({"created": created}, status=status.HTTP_201_CREATED)


class AudioZipImportView(APIView):
    """Multipart POST: audio_zip

    Saves all files in ZIP under listening/audio/ and returns the saved filenames.
    """

    permission_classes = [IsManagementUser]
    parser_classes = [MultiPartParser]

    def post(self, request):  # type: ignore[no-untyped-def]
        audio_zip = request.FILES.get("audio_zip")
        if not audio_zip:
            return Response({"detail": "audio_zip is required."}, status=status.HTTP_400_BAD_REQUEST)
        if audio_zip.size > _MAX_ZIP_BYTES:
            return Response({"detail": "Audio ZIP too large (max 50 MB)."}, status=status.HTTP_400_BAD_REQUEST)

        audio_bytes = audio_zip.read()
        zip_reader = zipfile.ZipFile(io.BytesIO(audio_bytes))

        saved: list[str] = []
        for name in zip_reader.namelist():
            if name.endswith("/"):
                continue
            if name.startswith("/") or ".." in name or "\\" in name:
                return Response({"detail": f"Unsafe filename in ZIP: {name}"}, status=400)

            data = zip_reader.read(name)
            basename = os.path.basename(name)
            saved_name = default_storage.save(f"listening/audio/{basename}", ContentFile(data))
            saved.append(saved_name.split("/")[-1])

        saved_sorted = sorted(set(saved))
        return Response({"saved": saved_sorted, "count": len(saved_sorted)}, status=status.HTTP_201_CREATED)
