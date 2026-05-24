"""AI-powered vocabulary explanation using Google Gemini."""
from __future__ import annotations

import logging

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Vocabulary

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a friendly JLPT Japanese tutor helping a student deeply understand a vocabulary word.
Given the word, its reading, basic meaning, and JLPT level, provide:
1. Nuanced meaning — any connotations, register (formal/casual), or usage context the basic meaning misses
2. Common mistakes or confusions with similar words (if applicable)
3. One natural example sentence in Japanese with English translation
4. A short mnemonic tip to remember the word

Keep it concise and practical. Plain text only, no markdown headers or bullet symbols."""

MOCK_EXPLANATION = (
    "This word carries a nuanced sense of ongoing effort rather than a single action, "
    "often used in formal and written contexts. "
    "Students sometimes confuse it with similar words that imply a completed result — "
    "the key difference is that this one emphasises the process.\n\n"
    "Example: 彼女は毎晩その言葉を練習しています。 (She practices that word every evening.)\n\n"
    "Mnemonic: Picture someone repeatedly tracing the kanji on paper — the repetition is built into the meaning."
)


def _get_client():
    api_key = getattr(settings, "GEMINI_API_KEY", "") or ""
    if not api_key:
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except ImportError:
        logger.warning("google-genai package not installed")
        return None


class VocabExplainView(APIView):
    """POST /api/vocab/<pk>/explain/ — generate an AI explanation for a vocabulary word."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int) -> Response:
        try:
            vocab = Vocabulary.objects.get(pk=pk)
        except Vocabulary.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if getattr(settings, "GEMINI_DEV_MOCK", False):
            logger.info("Vocab explain: using dev mock response")
            return Response({
                "word": vocab.word,
                "reading": vocab.reading,
                "jlpt_level": vocab.jlpt_level,
                "explanation": MOCK_EXPLANATION,
            })

        if not getattr(settings, "GEMINI_API_KEY", ""):
            return Response(
                {"detail": "AI explanation is not configured. Add GEMINI_API_KEY to .env."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        client = _get_client()
        if client is None:
            return Response(
                {"detail": "google-genai package not installed."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        from google.genai import types

        user_message = (
            f"JLPT Level: {vocab.jlpt_level}\n"
            f"Word: {vocab.word}\n"
            f"Reading: {vocab.reading or '(none)'}\n"
            f"Basic meaning: {vocab.meaning_en}\n\n"
            "Provide a concise learning explanation."
        )

        model_name = getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash-lite")
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=user_message,
                config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
            )
            explanation = response.text if response.text else ""
            return Response({
                "word": vocab.word,
                "reading": vocab.reading,
                "jlpt_level": vocab.jlpt_level,
                "explanation": explanation,
            })
        except Exception as exc:
            logger.error("Vocab explain API error for vocab %d: %s", pk, exc)
            return Response(
                {"detail": f"AI request failed: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
