"""AI-powered vocabulary explanation using Claude."""
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


def _get_client():
    api_key = getattr(settings, "ANTHROPIC_API_KEY", "") or ""
    if not api_key:
        return None
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except ImportError:
        logger.warning("anthropic package not installed")
        return None


class VocabExplainView(APIView):
    """POST /api/vocab/<pk>/explain/ — generate an AI explanation for a vocabulary word."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int) -> Response:
        if not getattr(settings, "ANTHROPIC_API_KEY", ""):
            return Response(
                {"detail": "AI explanation is not configured. Add ANTHROPIC_API_KEY to .env."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            vocab = Vocabulary.objects.get(pk=pk)
        except Vocabulary.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        client = _get_client()
        if client is None:
            return Response(
                {"detail": "Anthropic package not installed."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        user_message = (
            f"JLPT Level: {vocab.jlpt_level}\n"
            f"Word: {vocab.word}\n"
            f"Reading: {vocab.reading or '(none)'}\n"
            f"Basic meaning: {vocab.meaning_en}\n\n"
            "Provide a concise learning explanation."
        )

        try:
            import anthropic
            model = getattr(settings, "ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
            message = client.messages.create(
                model=model,
                max_tokens=600,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            )
            explanation = message.content[0].text if message.content else ""
            return Response({
                "word": vocab.word,
                "reading": vocab.reading,
                "jlpt_level": vocab.jlpt_level,
                "explanation": explanation,
            })
        except anthropic.APIError as exc:
            logger.error("Vocab explain API error for vocab %d: %s", pk, exc)
            return Response(
                {"detail": f"AI request failed: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
