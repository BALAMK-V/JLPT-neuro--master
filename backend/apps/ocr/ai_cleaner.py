"""
AI-powered JLPT question paper cleaner.

Uses the Anthropic Claude API to transform raw OCR text into clean,
structured question JSON — removing instructions, examples, watermarks,
headers, scoring guides, and other noise that OCR picks up from scanned papers.

Falls back gracefully to an empty list if the API key is not configured
or if the API call fails, so the regex parser result is always the baseline.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

# The maximum characters of OCR text we send per request.
# Claude's context window is large, but very long papers benefit from chunking.
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
- Time/duration notes
- "Do not open until told" type notices
- Any line that is clearly not part of an actual question

=== SECTION DETECTION ===
Map to one of: "vocabulary", "grammar", "reading", "listening"
- 語彙 / 文字 / 言葉 → vocabulary
- 文法 / ぶんぽう → grammar
- 読解 / どっかい → reading
- 聴解 / ちょうかい → listening
- When unsure, use "vocabulary"

=== QUESTION TYPE DETECTION ===
- Has 3–4 options → "multiple_choice"
- Has （ ）or blank to fill → "fill_blank"
- Has ★ or rearrangement markers → "sentence_arrange"

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


def _get_client():
    """Return an Anthropic client, or None if the SDK/key is not available."""
    api_key = getattr(settings, "ANTHROPIC_API_KEY", "") or ""
    if not api_key:
        return None
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except ImportError:
        logger.warning("anthropic package not installed — AI cleaning unavailable")
        return None


def _parse_json_response(text: str) -> list[dict[str, Any]]:
    """Extract JSON array from the model response, tolerating minor formatting issues."""
    text = text.strip()
    # Strip markdown code fences if the model added them despite instructions
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
        # Try to find the array by locating the first '[' and last ']'
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
    """Send one chunk of OCR text to Claude and return parsed questions."""
    import anthropic

    user_message = (
        f"JLPT Level: {level}\n\n"
        f"--- RAW OCR TEXT START ---\n{chunk}\n--- RAW OCR TEXT END ---\n\n"
        "Extract the real exam questions. Return only the JSON array."
    )

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",   # fast + cheap; upgrade to sonnet for harder papers
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        raw = message.content[0].text if message.content else ""
        return _parse_json_response(raw)

    except anthropic.APIError as exc:
        logger.error("Anthropic API error during AI cleaning: %s", exc)
        return []


def ai_clean_questions(ocr_text: str, level: str = "N3") -> list[dict[str, Any]]:
    """
    Main entry point.

    Takes raw OCR text and returns a cleaned list of question dicts.
    Returns an empty list if the API key is not set or the call fails —
    the caller should fall back to the regex parser result in that case.
    """
    client = _get_client()
    if client is None:
        return []

    # Split into chunks so very long papers don't hit context limits
    chunks = [ocr_text[i : i + MAX_CHARS] for i in range(0, len(ocr_text), MAX_CHARS)]
    all_questions: list[dict[str, Any]] = []
    order_offset = 0

    for chunk in chunks:
        questions = _clean_chunk(client, chunk, level)
        # Re-number orders to be continuous across chunks
        for q in questions:
            order_offset += 1
            q["order"] = order_offset
        all_questions.extend(questions)

    logger.info(
        "AI cleaner extracted %d questions from %d chunk(s)", len(all_questions), len(chunks)
    )
    return all_questions
