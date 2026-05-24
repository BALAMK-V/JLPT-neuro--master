"""
AI-powered JLPT question paper cleaner using Google Gemini.

Falls back gracefully to an empty list if the API key is not configured
or if the API call fails, so the regex parser result is always the baseline.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

MAX_CHARS = 12_000

SYSTEM_PROMPT = """You are an expert JLPT (Japanese Language Proficiency Test) question paper processor.

Your ONLY job is to extract real exam questions from raw OCR text and return them as clean JSON.

=== WHAT TO EXTRACT ===
Real JLPT exam questions that have:
- A question number (問1, 1., ①, [1], etc.)
- A question stem / sentence in Japanese
- 3–4 answer options (labeled A/B/C/D, ①②③④, アイウエ, or 1/2/3/4)

=== WHAT TO DISCARD (do NOT include in output) ===
- Section headings and part labels  (問題1, Part A, 第一部分, etc.)
- Printed instructions and directions  (e.g. "次の文の（ ）に入れるのに...")
- Example / sample questions  (例, 例題, Example, サンプル問題)
- Answer keys, score tables, rubrics
- Watermarks, exam centre names, copyright notices
- Page numbers, headers, footers

=== SECTION DETECTION ===
Map to one of: "vocabulary", "grammar", "reading", "listening"

=== OUTPUT FORMAT ===
Return ONLY a valid JSON array. No explanation, no markdown, no code fences.

[
  {
    "section": "vocabulary",
    "order": 1,
    "question_text": "彼は毎朝（　）を食べます。",
    "question_type": "multiple_choice",
    "options": [
      {"label": "A", "text": "ごはん"},
      {"label": "B", "text": "くるま"},
      {"label": "C", "text": "ほん"},
      {"label": "D", "text": "みず"}
    ]
  }
]

If no real questions are found, return an empty array: []
"""

MOCK_QUESTIONS = [
    {
        "section": "vocabulary",
        "order": 1,
        "question_text": "彼女は毎朝（　　）を飲みます。",
        "question_type": "multiple_choice",
        "options": [
            {"label": "A", "text": "コーヒー"},
            {"label": "B", "text": "じてんしゃ"},
            {"label": "C", "text": "えんぴつ"},
            {"label": "D", "text": "かばん"},
        ],
    },
    {
        "section": "grammar",
        "order": 2,
        "question_text": "早く起きる（　　）、遅刻しなかった。",
        "question_type": "multiple_choice",
        "options": [
            {"label": "A", "text": "ので"},
            {"label": "B", "text": "のに"},
            {"label": "C", "text": "から"},
            {"label": "D", "text": "ても"},
        ],
    },
]


def _get_client():
    api_key = getattr(settings, "GEMINI_API_KEY", "") or ""
    if not api_key:
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except ImportError:
        logger.warning("google-genai package not installed — AI cleaning unavailable")
        return None


def _parse_json_response(text: str) -> list[dict[str, Any]]:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(
            line for line in lines if not line.strip().startswith("```")
        ).strip()
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
    logger.warning("AI cleaner: could not parse JSON from response")
    return []


def _clean_chunk(client, chunk: str, level: str) -> list[dict[str, Any]]:
    from google.genai import types

    model_name = getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash-lite")
    user_message = (
        f"JLPT Level: {level}\n\n"
        f"--- RAW OCR TEXT START ---\n{chunk}\n--- RAW OCR TEXT END ---\n\n"
        "Extract the real exam questions. Return only the JSON array."
    )

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=user_message,
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
        )
        raw = response.text if response.text else ""
        return _parse_json_response(raw)
    except Exception as exc:
        logger.error("Gemini API error during AI cleaning: %s", exc)
        return []


def ai_clean_questions(ocr_text: str, level: str = "N3") -> list[dict[str, Any]]:
    """
    Main entry point. Takes raw OCR text and returns a cleaned list of question dicts.
    Returns mock data in dev mode, empty list on failure (caller falls back to regex parser).
    """
    if getattr(settings, "GEMINI_DEV_MOCK", False):
        logger.info("AI cleaner: using dev mock response")
        return MOCK_QUESTIONS

    client = _get_client()
    if client is None:
        return []

    chunks = [ocr_text[i : i + MAX_CHARS] for i in range(0, len(ocr_text), MAX_CHARS)]
    all_questions: list[dict[str, Any]] = []
    order_offset = 0

    for chunk in chunks:
        questions = _clean_chunk(client, chunk, level)
        for q in questions:
            order_offset += 1
            q["order"] = order_offset
        all_questions.extend(questions)

    logger.info(
        "AI cleaner extracted %d questions from %d chunk(s)", len(all_questions), len(chunks)
    )
    return all_questions
