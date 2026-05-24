"""AI-powered Japanese grammar checker using Google Gemini."""
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

MOCK_RESPONSE = {
    "is_correct": False,
    "naturalness": "unnatural",
    "corrected": "毎日日本語を勉強しています。",
    "overall_comment": "Good effort! There is a small particle error, but the overall structure is clear.",
    "errors": [
        {
            "fragment": "日本語を勉強する",
            "correction": "日本語を勉強しています",
            "explanation": "Use the て-form + います (〜ています) to express an ongoing habitual action.",
        }
    ],
    "jlpt_points": ["〜ています", "毎日 + verb pattern"],
}


def _get_client():
    api_key = getattr(settings, "GEMINI_API_KEY", "") or ""
    if not api_key:
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
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
        sentence = (request.data.get("sentence") or "").strip()
        if not sentence:
            return Response({"detail": "sentence is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(sentence) > 500:
            return Response({"detail": "sentence too long (max 500 characters)."}, status=status.HTTP_400_BAD_REQUEST)

        jlpt_level = (request.data.get("jlpt_level") or "").strip() or "unknown"

        if getattr(settings, "GEMINI_DEV_MOCK", False):
            logger.info("Grammar check: using dev mock response")
            return Response({"sentence": sentence, **MOCK_RESPONSE})

        if not getattr(settings, "GEMINI_API_KEY", ""):
            return Response(
                {"detail": "AI grammar check is not configured. Add GEMINI_API_KEY to .env."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        client = _get_client()
        if client is None:
            return Response({"detail": "google-genai package not installed."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        from google.genai import types

        user_msg = f"Student JLPT level: {jlpt_level}\n\nSentence to check:\n{sentence}"
        model_name = getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash-lite")

        try:
            response = client.models.generate_content(
                model=model_name,
                contents=user_msg,
                config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
            )
            raw = response.text if response.text else "{}"
            result = _parse_json(raw)
            if not result:
                return Response({"detail": "AI returned unexpected format."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response({"sentence": sentence, **result})
        except Exception as exc:
            logger.error("Grammar check API error: %s", exc)
            return Response({"detail": f"AI request failed: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
