from __future__ import annotations

from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, status, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.flashcards.models import ImportLog
from apps.import_utils import ImportFileError, parse_import_file
from apps.users.permissions import IsManagementUser

from .models import JLPTLevel, Kanji, KanjiExample, Vocabulary
from .serializers import KanjiSerializer, VocabularySerializer


class KanjiViewSet(viewsets.ModelViewSet):
    queryset = Kanji.objects.all().prefetch_related("examples")
    serializer_class = KanjiSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["jlpt_level"]
    search_fields = ["character", "meaning_en", "onyomi", "kunyomi"]
    ordering_fields = ["id", "character", "jlpt_level"]


class VocabularyViewSet(viewsets.ModelViewSet):
    queryset = Vocabulary.objects.all().prefetch_related("related_kanji")
    serializer_class = VocabularySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["jlpt_level"]
    search_fields = ["word", "reading", "meaning_en"]
    ordering_fields = ["id", "word", "jlpt_level"]


class KanjiImportView(APIView):
    """Multipart POST: import_file (CSV, JSON, or XLSX)

    Required columns: character, meaning_en
    Optional columns: onyomi, kunyomi, jlpt_level, examples
    examples format: "JP|EN; JP|EN; JP" (semicolon-separated; EN optional)
    """

    permission_classes = [IsManagementUser]
    parser_classes = [MultiPartParser]

    def post(self, request):  # type: ignore[no-untyped-def]
        import_file = request.FILES.get("import_file") or request.FILES.get("csv_file")
        if not import_file:
            return Response({"detail": "import_file is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rows = parse_import_file(import_file, import_file.name)
        except ImportFileError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if not rows:
            return Response({"detail": "File has no data rows."}, status=status.HTTP_400_BAD_REQUEST)

        required = ["character", "meaning_en"]
        missing = [h for h in required if h not in rows[0]]
        if missing:
            return Response({"detail": f"Missing required columns: {', '.join(missing)}"}, status=400)

        valid_levels = {c for c, _ in JLPTLevel.choices}
        created = 0
        updated = 0
        with transaction.atomic():
            for idx, raw in enumerate(rows, start=2):
                ch = (raw.get("character") or "").strip()
                if not ch or len(ch) != 1:
                    return Response({"detail": f"Invalid character at row {idx}."}, status=400)

                level = (raw.get("jlpt_level") or JLPTLevel.N2).strip()
                if level not in valid_levels:
                    return Response({"detail": f"Invalid jlpt_level at row {idx}."}, status=400)

                defaults = {
                    "onyomi": (raw.get("onyomi") or "").strip(),
                    "kunyomi": (raw.get("kunyomi") or "").strip(),
                    "meaning_en": (raw.get("meaning_en") or "").strip(),
                    "jlpt_level": level,
                }

                obj, was_created = Kanji.objects.update_or_create(character=ch, defaults=defaults)
                if was_created:
                    created += 1
                else:
                    updated += 1

                examples_str = (raw.get("examples") or "").strip()
                if examples_str:
                    obj.examples.all().delete()
                    parts = [p.strip() for p in examples_str.split(";") if p.strip()]
                    for part in parts:
                        if "|" in part:
                            jp, en = part.split("|", 1)
                            KanjiExample.objects.create(kanji=obj, sentence_jp=jp.strip(), sentence_en=en.strip())
                        else:
                            KanjiExample.objects.create(kanji=obj, sentence_jp=part.strip(), sentence_en="")

        ImportLog.objects.create(
            user=request.user, content_type=ImportLog.ContentType.KANJI,
            filename=import_file.name, file_format=import_file.name.rsplit(".", 1)[-1].lower() if "." in import_file.name else "csv",
            rows_imported=created, rows_updated=updated,
        )
        return Response({"created": created, "updated": updated}, status=status.HTTP_201_CREATED)


class VocabularyImportView(APIView):
    """Multipart POST: import_file (CSV, JSON, or XLSX)

    Required columns: word, meaning_en
    Optional columns: reading, jlpt_level, related_kanji
    related_kanji format: "勉;強" (semicolon-separated kanji characters)
    """

    permission_classes = [IsManagementUser]
    parser_classes = [MultiPartParser]

    def post(self, request):  # type: ignore[no-untyped-def]
        import_file = request.FILES.get("import_file") or request.FILES.get("csv_file")
        if not import_file:
            return Response({"detail": "import_file is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rows = parse_import_file(import_file, import_file.name)
        except ImportFileError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if not rows:
            return Response({"detail": "File has no data rows."}, status=status.HTTP_400_BAD_REQUEST)

        required = ["word", "meaning_en"]
        missing = [h for h in required if h not in rows[0]]
        if missing:
            return Response({"detail": f"Missing required columns: {', '.join(missing)}"}, status=400)

        valid_levels = {c for c, _ in JLPTLevel.choices}
        created = 0
        updated = 0
        with transaction.atomic():
            for idx, raw in enumerate(rows, start=2):
                word = (raw.get("word") or "").strip()
                if not word:
                    return Response({"detail": f"Empty word at row {idx}."}, status=400)

                level = (raw.get("jlpt_level") or JLPTLevel.N2).strip()
                if level not in valid_levels:
                    return Response({"detail": f"Invalid jlpt_level at row {idx}."}, status=400)

                reading = (raw.get("reading") or "").strip()
                defaults = {
                    "meaning_en": (raw.get("meaning_en") or "").strip(),
                    "jlpt_level": level,
                }

                obj, was_created = Vocabulary.objects.update_or_create(word=word, reading=reading, defaults=defaults)
                if was_created:
                    created += 1
                else:
                    updated += 1

                rel = (raw.get("related_kanji") or "").strip()
                if rel:
                    chars = [c.strip() for c in rel.replace(",", ";").split(";") if c.strip()]
                    kanji_objs = list(Kanji.objects.filter(character__in=chars))
                    obj.related_kanji.set(kanji_objs)

        ImportLog.objects.create(
            user=request.user, content_type=ImportLog.ContentType.VOCAB,
            filename=import_file.name, file_format=import_file.name.rsplit(".", 1)[-1].lower() if "." in import_file.name else "csv",
            rows_imported=created, rows_updated=updated,
        )
        return Response({"created": created, "updated": updated}, status=status.HTTP_201_CREATED)
