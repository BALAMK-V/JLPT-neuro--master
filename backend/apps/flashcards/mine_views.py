"""Sentence Mining — Gemini extracts unknown words from pasted Japanese text and creates flashcards."""
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

MOCK_WORDS = [
    {"word": "環境", "reading": "かんきょう", "meaning": "environment", "example_jp": "環境問題は深刻です。", "example_en": "Environmental issues are serious."},
    {"word": "影響", "reading": "えいきょう", "meaning": "influence; impact", "example_jp": "天気は気分に影響する。", "example_en": "Weather affects your mood."},
    {"word": "解決", "reading": "かいけつ", "meaning": "resolution; solution", "example_jp": "問題を解決する方法を探している。", "example_en": "I am looking for a way to solve the problem."},
    {"word": "経験", "reading": "けいけん", "meaning": "experience", "example_jp": "海外での経験が役に立った。", "example_en": "My experience abroad was useful."},
    {"word": "目標", "reading": "もくひょう", "meaning": "goal; target", "example_jp": "N2合格が今年の目標です。", "example_en": "Passing N2 is my goal this year."},
]


def _get_client():
    api_key = getattr(settings, "GEMINI_API_KEY", "") or ""
    if not api_key:
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
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
        text = (request.data.get("text") or "").strip()
        deck_id = request.data.get("deck_id")
        jlpt_level = (request.data.get("jlpt_level") or "N3").strip()

        if not text:
            return Response({"detail": "text is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(text) > 3000:
            return Response({"detail": "text too long (max 3000 characters)."}, status=status.HTTP_400_BAD_REQUEST)

        deck = None
        if deck_id:
            try:
                deck = Deck.objects.get(id=deck_id, user=request.user)
            except Deck.DoesNotExist:
                return Response({"detail": "Deck not found."}, status=status.HTTP_404_NOT_FOUND)

        if getattr(settings, "GEMINI_DEV_MOCK", False):
            logger.info("Sentence mining: using dev mock response")
            words = MOCK_WORDS
        else:
            if not getattr(settings, "GEMINI_API_KEY", ""):
                return Response(
                    {"detail": "Sentence mining not configured. Add GEMINI_API_KEY to .env."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

            client = _get_client()
            if client is None:
                return Response({"detail": "google-genai package not installed."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

            from google.genai import types

            user_msg = f"Student JLPT level: {jlpt_level}\n\nJapanese text to mine:\n{text}"
            model_name = getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash-lite")

            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=user_msg,
                    config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
                )
                raw = response.text if response.text else "[]"
            except Exception as exc:
                logger.error("Sentence mining API error: %s", exc)
                return Response({"detail": f"AI request failed: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
                        pass

        return Response({
            "words_found": len(words),
            "cards_created": cards_created,
            "words": words,
        })
