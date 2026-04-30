"""AI-powered Japanese grammar checker using Claude."""
from __future__ import annotations

import json
import logging

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a strict but friendly Japanese language teacher helping a JLPT student.
The student will give you a Japanese sentence. Analyze it and return ONLY a valid JSON object — no markdown, no code fences.

JSON shape:
{
  "is_correct": true/false,
  "naturalness": "natural" | "unnatural" | "incorrect",
  "corrected": "<corrected sentence or same if already correct>",
  "overall_comment": "<one or two sentence summary in English>",
  "errors": [
    {
      "fragment": "<the problematic part>",
      "correction": "<how it should be>",
      "explanation": "<why, in English>"
    }
  ],
  "jlpt_points": ["<grammar point 1>", "<grammar point 2>"]
}

Rules:
- errors array is empty [] when the sentence is correct
- jlpt_points lists relevant JLPT grammar patterns (e.g. "〜てください", "〜ている", "〜ば〜のに")
- overall_comment must be encouraging even when correcting
- corrected must be a full sentence, not a fragment
- Return ONLY the JSON object — nothing else"""


def _get_client():
    api_key = getattr(settings, "ANTHROPIC_API_KEY", "") or ""
    if not api_key:
        return None
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except ImportError:
        return None


def _parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(l for l in lines if not l.strip().startswith("```")).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass
    return {}


class GrammarCheckView(APIView):
    """POST /api/grammar/check/  body: { sentence: "..." [, jlpt_level: "N3"] }"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request) -> Response:
        if not getattr(settings, "ANTHROPIC_API_KEY", ""):
            return Response(
                {"detail": "AI grammar check is not configured. Add ANTHROPIC_API_KEY to .env."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        sentence = (request.data.get("sentence") or "").strip()
        if not sentence:
            return Response({"detail": "sentence is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(sentence) > 500:
            return Response({"detail": "sentence too long (max 500 characters)."}, status=status.HTTP_400_BAD_REQUEST)

        jlpt_level = (request.data.get("jlpt_level") or "").strip() or "unknown"

        client = _get_client()
        if client is None:
            return Response({"detail": "anthropic package not installed."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        user_msg = f"Student JLPT level: {jlpt_level}\n\nSentence to check:\n{sentence}"

        try:
            import anthropic
            model = getattr(settings, "ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
            message = client.messages.create(
                model=model,
                max_tokens=800,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_msg}],
            )
            raw = message.content[0].text if message.content else "{}"
            result = _parse_json(raw)
            if not result:
                return Response({"detail": "AI returned unexpected format."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response({"sentence": sentence, **result})

        except anthropic.APIError as exc:
            logger.error("Grammar check API error: %s", exc)
            return Response({"detail": f"AI request failed: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
