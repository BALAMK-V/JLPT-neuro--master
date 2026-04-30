"""Sentence Mining — Claude extracts unknown words from pasted Japanese text and creates flashcards."""
from __future__ import annotations

import json
import logging

from django.conf import settings
from django.db import transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.content.models import Vocabulary
from .models import Card, Deck

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a Japanese language assistant helping a JLPT student mine vocabulary from text.

The student will paste a Japanese text and tell you their JLPT level.
Your task:
1. Find words in the text that are typically studied at or above that JLPT level
2. Prioritize words the student likely doesn't know yet (avoid very basic N5/N4 words if the student is N2+)
3. For each word, provide the dictionary form, reading, English meaning, and an example sentence from the text (or a short one you create)

Return ONLY a valid JSON array — no markdown, no code fences:
[
  {
    "word": "<word in Japanese>",
    "reading": "<hiragana reading>",
    "meaning": "<concise English meaning>",
    "example_jp": "<example sentence in Japanese>",
    "example_en": "<English translation of example>"
  }
]

Rules:
- Return 5–15 words maximum (the most useful ones)
- Prefer words that appear in the text
- Include only words, not grammar particles or conjunctions
- Return ONLY the JSON array"""


def _get_client():
    api_key = getattr(settings, "ANTHROPIC_API_KEY", "") or ""
    if not api_key:
        return None
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except ImportError:
        return None


def _parse_json_array(text: str) -> list:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(l for l in lines if not l.strip().startswith("```")).strip()
    try:
        result = json.loads(text)
        return result if isinstance(result, list) else []
    except json.JSONDecodeError:
        start, end = text.find("["), text.rfind("]")
        if start != -1 and end != -1:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass
    return []


class SentenceMineView(APIView):
    """POST /api/flash/mine/
    Body: { text: "<Japanese passage>", deck_id: <int>, jlpt_level: "N3" }
    Returns: { words_found, cards_created, words: [...] }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request) -> Response:
        if not getattr(settings, "ANTHROPIC_API_KEY", ""):
            return Response(
                {"detail": "Sentence mining not configured. Add ANTHROPIC_API_KEY to .env."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        text = (request.data.get("text") or "").strip()
        deck_id = request.data.get("deck_id")
        jlpt_level = (request.data.get("jlpt_level") or "N3").strip()

        if not text:
            return Response({"detail": "text is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(text) > 3000:
            return Response({"detail": "text too long (max 3000 characters)."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate deck ownership if provided
        deck = None
        if deck_id:
            try:
                deck = Deck.objects.get(id=deck_id, user=request.user)
            except Deck.DoesNotExist:
                return Response({"detail": "Deck not found."}, status=status.HTTP_404_NOT_FOUND)

        client = _get_client()
        if client is None:
            return Response({"detail": "anthropic package not installed."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        user_msg = f"Student JLPT level: {jlpt_level}\n\nJapanese text to mine:\n{text}"
        model = getattr(settings, "ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")

        try:
            import anthropic
            message = client.messages.create(
                model=model,
                max_tokens=2000,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_msg}],
            )
        except anthropic.APIError as exc:
            logger.error("Sentence mining API error: %s", exc)
            return Response({"detail": f"AI request failed: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        raw = message.content[0].text if message.content else "[]"
        words = _parse_json_array(raw)

        if not words:
            return Response({"detail": "AI returned no words."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        cards_created = 0
        if deck:
            with transaction.atomic():
                for w in words:
                    word = (w.get("word") or "").strip()
                    reading = (w.get("reading") or "").strip()
                    meaning = (w.get("meaning") or "").strip()
                    example_jp = (w.get("example_jp") or "").strip()
                    example_en = (w.get("example_en") or "").strip()
                    if not word or not meaning:
                        continue

                    front = word
                    back_parts = []
                    if reading:
                        back_parts.append(f"Reading: {reading}")
                    back_parts.append(f"Meaning: {meaning}")
                    if example_jp:
                        back_parts.append(f"\nExample: {example_jp}")
                    if example_en:
                        back_parts.append(f"({example_en})")

                    try:
                        # Match to a Vocabulary object if it exists
                        vocab_obj = Vocabulary.objects.filter(word=word).first()
                        Card.objects.create(
                            deck=deck,
                            front=front,
                            back="\n".join(back_parts),
                            vocab=vocab_obj,
                            tags=["mined"],
                        )
                        cards_created += 1
                    except Exception:
                        pass  # Skip duplicates or integrity errors

        return Response({
            "words_found": len(words),
            "cards_created": cards_created,
            "words": words,
        })
