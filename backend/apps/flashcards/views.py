from __future__ import annotations

import csv
import io
from dataclasses import dataclass

from django.db import transaction
from django.db.utils import IntegrityError
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.content.models import Kanji, JLPTLevel, Vocabulary
from apps.users.models import UserProfile

from .models import Card, Deck
from .serializers import CardSerializer, DeckSerializer, ReviewApplySerializer


def _ensure_default_decks(user) -> tuple[Deck, Deck]:
    """Create 2 locked decks per user: Kanji + Vocabulary."""

    UserProfile.objects.get_or_create(user=user)
    level = getattr(user.profile, "jlpt_level", JLPTLevel.N2)

    def get_or_create_locked(system_key: str, name: str, deck_type: str) -> Deck:
        try:
            deck, _created = Deck.objects.get_or_create(
                user=user,
                system_key=system_key,
                defaults={
                    "name": name,
                    "deck_type": deck_type,
                    "jlpt_level": level,
                    "is_locked": True,
                },
            )
        except IntegrityError:
            # If user already created a deck with the same name, reuse it but lock it.
            deck = Deck.objects.get(user=user, name=name)
            deck.system_key = system_key
            deck.deck_type = deck_type
            deck.is_locked = True

        # Keep default deck level in sync with profile level.
        changed = False
        if deck.jlpt_level != level:
            deck.jlpt_level = level
            changed = True
        if deck.name != name:
            deck.name = name
            changed = True
        if deck.deck_type != deck_type:
            deck.deck_type = deck_type
            changed = True
        if not deck.is_locked:
            deck.is_locked = True
            changed = True
        if deck.system_key != system_key:
            deck.system_key = system_key
            changed = True
        if changed:
            deck.save()
        return deck

    kanji_deck = get_or_create_locked("kanji_default", "Kanji (Default)", Deck.DeckType.KANJI)
    vocab_deck = get_or_create_locked("vocab_default", "Vocabulary (Default)", Deck.DeckType.VOCAB)
    return kanji_deck, vocab_deck


def _sync_locked_deck(deck: Deck) -> int:
    """Populate locked default decks with content items for the deck JLPT level."""

    if not deck.is_locked:
        return 0

    level = deck.jlpt_level or JLPTLevel.N2
    created = 0

    if deck.deck_type == Deck.DeckType.KANJI:
        # Remove cards that no longer match the deck level.
        Card.objects.filter(deck=deck, kanji__isnull=False).exclude(kanji__jlpt_level=level).delete()
        existing = set(Card.objects.filter(deck=deck, kanji__isnull=False).values_list("kanji_id", flat=True))
        missing = list(Kanji.objects.filter(jlpt_level=level).exclude(id__in=existing))
        cards = [
            Card(
                deck=deck,
                kanji=k,
                front=k.character,
                back=f"{k.meaning_en}\nonyomi: {k.onyomi}\nkunyomi: {k.kunyomi}".strip(),
                tags=[level, "kanji"],
            )
            for k in missing
        ]
        if cards:
            Card.objects.bulk_create(cards, batch_size=500, ignore_conflicts=True)
            created = len(cards)
        return created

    if deck.deck_type == Deck.DeckType.VOCAB:
        Card.objects.filter(deck=deck, vocab__isnull=False).exclude(vocab__jlpt_level=level).delete()
        existing = set(Card.objects.filter(deck=deck, vocab__isnull=False).values_list("vocab_id", flat=True))
        missing = list(Vocabulary.objects.filter(jlpt_level=level).exclude(id__in=existing))
        cards = [
            Card(
                deck=deck,
                vocab=v,
                front=v.word,
                back=f"{v.meaning_en}\nreading: {v.reading}".strip(),
                tags=[level, "vocab"],
            )
            for v in missing
        ]
        if cards:
            Card.objects.bulk_create(cards, batch_size=500, ignore_conflicts=True)
            created = len(cards)
        return created

    return 0


class DeckViewSet(viewsets.ModelViewSet):
    serializer_class = DeckSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["deck_type", "jlpt_level"]
    search_fields = ["name"]
    ordering_fields = ["id", "updated_at", "name"]

    def get_queryset(self):  # type: ignore[no-untyped-def]
        _ensure_default_decks(self.request.user)
        now = timezone.now()
        return (
            Deck.objects.filter(user=self.request.user)
            .annotate(
                total_cards=Count("cards"),
                due_count=Count("cards", filter=Q(cards__suspended=False, cards__due_at__lte=now)),
            )
            .order_by("-updated_at")
        )

    def perform_create(self, serializer):  # type: ignore[no-untyped-def]
        serializer.save(user=self.request.user, is_locked=False, system_key="")

    def update(self, request, *args, **kwargs):  # type: ignore[no-untyped-def]
        obj = self.get_object()
        if obj.is_locked:
            return Response({"detail": "This deck is locked."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):  # type: ignore[no-untyped-def]
        obj = self.get_object()
        if obj.is_locked:
            return Response({"detail": "This deck is locked."}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):  # type: ignore[no-untyped-def]
        obj = self.get_object()
        if obj.is_locked:
            return Response({"detail": "This deck is locked."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class CardViewSet(viewsets.ModelViewSet):
    serializer_class = CardSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["deck", "suspended", "kanji", "vocab"]
    search_fields = ["front", "back"]
    ordering_fields = ["id", "due_at", "updated_at"]

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return Card.objects.filter(deck__user=self.request.user).select_related("deck", "kanji", "vocab")

    def list(self, request, *args, **kwargs):  # type: ignore[no-untyped-def]
        deck_id = request.query_params.get("deck")
        if deck_id:
            deck = Deck.objects.filter(id=deck_id, user=request.user).first()
            if deck and deck.is_locked:
                _sync_locked_deck(deck)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):  # type: ignore[no-untyped-def]
        deck_id = request.data.get("deck")
        if deck_id:
            deck = Deck.objects.filter(id=deck_id, user=request.user).first()
            if deck and deck.is_locked:
                return Response({"detail": "Cards in this deck are locked."}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):  # type: ignore[no-untyped-def]
        obj = self.get_object()
        if obj.deck.is_locked:
            return Response({"detail": "Cards in this deck are locked."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):  # type: ignore[no-untyped-def]
        obj = self.get_object()
        if obj.deck.is_locked:
            return Response({"detail": "Cards in this deck are locked."}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):  # type: ignore[no-untyped-def]
        obj = self.get_object()
        if obj.deck.is_locked:
            return Response({"detail": "Cards in this deck are locked."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class FlashNextView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):  # type: ignore[no-untyped-def]
        deck_id = request.query_params.get("deck_id")
        limit = int(request.query_params.get("limit") or 20)
        limit = max(1, min(200, limit))

        qs = Card.objects.filter(deck__user=request.user, suspended=False, due_at__lte=timezone.now()).select_related("deck", "kanji", "vocab")
        if deck_id:
            deck = Deck.objects.filter(id=deck_id, user=request.user).first()
            if deck and deck.is_locked:
                _sync_locked_deck(deck)
            qs = qs.filter(deck_id=deck_id)

        items = list(qs.order_by("due_at", "id")[:limit])
        return Response({"count": len(items), "results": CardSerializer(items, many=True).data})


class FlashReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):  # type: ignore[no-untyped-def]
        s = ReviewApplySerializer(data=request.data)
        s.is_valid(raise_exception=True)

        try:
            card = Card.objects.select_related("deck").get(id=s.validated_data["card_id"], deck__user=request.user)
        except Card.DoesNotExist:
            return Response({"detail": "Card not found."}, status=status.HTTP_404_NOT_FOUND)
        card.apply_rating(s.validated_data["rating"])
        card.save()
        return Response(CardSerializer(card).data, status=status.HTTP_200_OK)


@dataclass(frozen=True)
class ImportResult:
    created: int
    skipped: int


class FlashDueAllView(APIView):
    """GET /api/flash/due-all/ — total due count + first N cards across all decks."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):  # type: ignore[no-untyped-def]
        limit = int(request.query_params.get("limit") or 20)
        limit = max(1, min(200, limit))

        now = timezone.now()
        qs = Card.objects.filter(
            deck__user=request.user, suspended=False, due_at__lte=now
        ).select_related("deck", "kanji", "vocab")

        total_due = qs.count()
        items = list(qs.order_by("due_at", "id")[:limit])
        return Response(
            {"total_due": total_due, "count": len(items), "results": CardSerializer(items, many=True).data}
        )


class FlashLeechesView(APIView):
    """GET /api/flash/leeches/ — list suspended leech cards (lapses >= 8).
       POST /api/flash/leeches/<id>/unsuspend/ — manually unsuspend a leech."""

    LEECH_THRESHOLD = 8
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):  # type: ignore[no-untyped-def]
        leeches = Card.objects.filter(
            deck__user=request.user, suspended=True, lapses__gte=self.LEECH_THRESHOLD
        ).select_related("deck", "kanji", "vocab").order_by("-lapses")
        return Response({"count": leeches.count(), "results": CardSerializer(leeches, many=True).data})

    def post(self, request, card_id: int):  # type: ignore[no-untyped-def]
        try:
            card = Card.objects.get(id=card_id, deck__user=request.user)
        except Card.DoesNotExist:
            return Response({"detail": "Card not found."}, status=status.HTTP_404_NOT_FOUND)
        card.suspended = False
        card.lapses = 0
        card.repetitions = 0
        card.interval_days = 0
        card.due_at = timezone.now()
        card.save()
        return Response(CardSerializer(card).data)


class FlashImportView(APIView):
    """Import flashcards from a simple CSV (Anki-like).

    Multipart POST:
      - csv_file (required)
      - deck_id (optional) OR deck_name + deck_type (optional)

    CSV headers (case-insensitive):
      front, back, tags
      kanji_character (optional)
      vocab_word (optional), vocab_reading (optional)
      jlpt_level (optional)

    tags: semicolon-separated.
    """

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):  # type: ignore[no-untyped-def]
        csv_file = request.FILES.get("csv_file")
        if not csv_file:
            return Response({"detail": "csv_file is required."}, status=status.HTTP_400_BAD_REQUEST)

        deck_id = request.data.get("deck_id")
        deck_name = (request.data.get("deck_name") or "").strip() or "Imported"
        deck_type = (request.data.get("deck_type") or Deck.DeckType.CUSTOM).strip() or Deck.DeckType.CUSTOM

        if deck_type not in {c for c, _ in Deck.DeckType.choices}:
            return Response({"detail": "Invalid deck_type."}, status=400)

        if deck_id:
            try:
                deck = Deck.objects.get(id=deck_id, user=request.user)
            except Deck.DoesNotExist:
                return Response({"detail": "Deck not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            deck, _ = Deck.objects.get_or_create(user=request.user, name=deck_name, defaults={"deck_type": deck_type})

        if deck.is_locked:
            return Response({"detail": "This deck is locked."}, status=status.HTTP_403_FORBIDDEN)

        decoded = csv_file.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(decoded))
        if not reader.fieldnames:
            return Response({"detail": "CSV has no headers."}, status=400)

        normalized = {h.strip().lower(): h for h in reader.fieldnames if h}
        if "front" not in normalized and "kanji_character" not in normalized and "vocab_word" not in normalized:
            return Response({"detail": "CSV must include front/back or kanji_character or vocab_word."}, status=400)

        def get(raw: dict[str, str], name: str) -> str:
            return (raw.get(normalized.get(name, name)) or "").strip()

        created = 0
        skipped = 0

        with transaction.atomic():
            for idx, raw in enumerate(reader, start=2):
                tags_raw = get(raw, "tags")
                tags = [t.strip() for t in tags_raw.split(";") if t.strip()] if tags_raw else []

                ch = get(raw, "kanji_character")
                word = get(raw, "vocab_word")
                reading = get(raw, "vocab_reading")

                kanji = Kanji.objects.filter(character=ch).first() if ch else None
                vocab = None
                if word:
                    vocab_qs = Vocabulary.objects.filter(word=word)
                    vocab = vocab_qs.filter(reading=reading).first() if reading else vocab_qs.first()

                front = get(raw, "front")
                back = get(raw, "back")
                if not front and kanji:
                    front = kanji.character
                    back = f"{kanji.meaning_en}\nonyomi: {kanji.onyomi}\nkunyomi: {kanji.kunyomi}".strip()
                if not front and vocab:
                    front = vocab.word
                    back = f"{vocab.meaning_en}\nreading: {vocab.reading}".strip()

                if not front or not back:
                    skipped += 1
                    continue

                Card.objects.create(deck=deck, kanji=kanji, vocab=vocab, front=front, back=back, tags=tags)
                created += 1

        return Response({"deck_id": deck.id, "created": created, "skipped": skipped}, status=status.HTTP_201_CREATED)
