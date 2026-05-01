from __future__ import annotations

import csv
import io

from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, status, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

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


_MAX_CSV_BYTES = 5 * 1024 * 1024  # 5 MB


class KanjiImportView(APIView):
    """Multipart POST: csv_file

    CSV headers (case-insensitive):
      character, onyomi, kunyomi, meaning_en, jlpt_level, examples

    examples format (optional):
      "JP|EN; JP|EN; JP" (semicolon-separated; EN optional)
    """

    permission_classes = [IsManagementUser]
    parser_classes = [MultiPartParser]

    def post(self, request):  # type: ignore[no-untyped-def]
        csv_file = request.FILES.get("csv_file")
        if not csv_file:
            return Response({"detail": "csv_file is required."}, status=status.HTTP_400_BAD_REQUEST)
        if csv_file.size > _MAX_CSV_BYTES:
            return Response({"detail": "File too large (max 5 MB)."}, status=status.HTTP_400_BAD_REQUEST)

        decoded = csv_file.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(decoded))
        if not reader.fieldnames:
            return Response({"detail": "CSV has no headers."}, status=status.HTTP_400_BAD_REQUEST)

        normalized = {h.strip().lower(): h for h in reader.fieldnames if h}
        required = ["character", "meaning_en"]
        missing = [h for h in required if h not in normalized]
        if missing:
            return Response({"detail": f"Missing required headers: {', '.join(missing)}"}, status=400)

        def get(raw, name: str) -> str:
            return (raw.get(normalized.get(name, name)) or "").strip()

        created = 0
        updated = 0
        with transaction.atomic():
            for idx, raw in enumerate(reader, start=2):
                ch = get(raw, "character")
                if not ch or len(ch) != 1:
                    return Response({"detail": f"Invalid character at line {idx}."}, status=400)

                level = get(raw, "jlpt_level") or JLPTLevel.N2
                if level not in {c for c, _ in JLPTLevel.choices}:
                    return Response({"detail": f"Invalid jlpt_level at line {idx}."}, status=400)

                defaults = {
                    "onyomi": get(raw, "onyomi"),
                    "kunyomi": get(raw, "kunyomi"),
                    "meaning_en": get(raw, "meaning_en"),
                    "jlpt_level": level,
                }

                obj, was_created = Kanji.objects.update_or_create(character=ch, defaults=defaults)
                if was_created:
                    created += 1
                else:
                    updated += 1

                examples_str = get(raw, "examples")
                if examples_str:
                    obj.examples.all().delete()
                    parts = [p.strip() for p in examples_str.split(";") if p.strip()]
                    for part in parts:
                        if "|" in part:
                            jp, en = part.split("|", 1)
                            KanjiExample.objects.create(kanji=obj, sentence_jp=jp.strip(), sentence_en=en.strip())
                        else:
                            KanjiExample.objects.create(kanji=obj, sentence_jp=part.strip(), sentence_en="")

        return Response({"created": created, "updated": updated}, status=status.HTTP_201_CREATED)


class VocabularyImportView(APIView):  # management-only
    """Multipart POST: csv_file

    CSV headers (case-insensitive):
      word, reading, meaning_en, jlpt_level, related_kanji

    related_kanji format (optional):
      "勉;強" (semicolon-separated kanji characters)
    """

    permission_classes = [IsManagementUser]
    parser_classes = [MultiPartParser]

    def post(self, request):  # type: ignore[no-untyped-def]
        csv_file = request.FILES.get("csv_file")
        if not csv_file:
            return Response({"detail": "csv_file is required."}, status=status.HTTP_400_BAD_REQUEST)
        if csv_file.size > _MAX_CSV_BYTES:
            return Response({"detail": "File too large (max 5 MB)."}, status=status.HTTP_400_BAD_REQUEST)

        decoded = csv_file.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(decoded))
        if not reader.fieldnames:
            return Response({"detail": "CSV has no headers."}, status=status.HTTP_400_BAD_REQUEST)

        normalized = {h.strip().lower(): h for h in reader.fieldnames if h}
        required = ["word", "meaning_en"]
        missing = [h for h in required if h not in normalized]
        if missing:
            return Response({"detail": f"Missing required headers: {', '.join(missing)}"}, status=400)

        def get(raw, name: str) -> str:
            return (raw.get(normalized.get(name, name)) or "").strip()

        created = 0
        updated = 0
        with transaction.atomic():
            for idx, raw in enumerate(reader, start=2):
                word = get(raw, "word")
                if not word:
                    return Response({"detail": f"Invalid word at line {idx}."}, status=400)

                level = get(raw, "jlpt_level") or JLPTLevel.N2
                if level not in {c for c, _ in JLPTLevel.choices}:
                    return Response({"detail": f"Invalid jlpt_level at line {idx}."}, status=400)

                reading = get(raw, "reading")
                defaults = {
                    "meaning_en": get(raw, "meaning_en"),
                    "jlpt_level": level,
                }

                obj, was_created = Vocabulary.objects.update_or_create(word=word, reading=reading, defaults=defaults)
                if was_created:
                    created += 1
                else:
                    updated += 1

                rel = get(raw, "related_kanji")
                if rel:
                    chars = [c.strip() for c in rel.replace(",", ";").split(";") if c.strip()]
                    kanji_objs = list(Kanji.objects.filter(character__in=chars))
                    obj.related_kanji.set(kanji_objs)

        return Response({"created": created, "updated": updated}, status=status.HTTP_201_CREATED)
