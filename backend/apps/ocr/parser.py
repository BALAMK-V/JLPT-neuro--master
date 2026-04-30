"""
JLPT question paper parser.

Converts raw OCR text into structured question dicts:
  {
    "section": "vocabulary" | "grammar" | "reading" | "listening",
    "order": int,
    "question_text": str,
    "options": [{"label": "A", "text": "..."}, ...],
    "question_type": "multiple_choice" | "fill_blank" | "sentence_arrange",
  }

Handles:
  - Japanese section headings: 語彙, 文法, 読解, 聴解
  - Question numbering: 問1, 問２, [1], (1), ①, 1., 1）etc.
  - Option numbering: ①②③④, 1. 2. 3. 4., A B C D, ア イ ウ エ
  - Full-width digit normalisation
"""
from __future__ import annotations

import re
from typing import Any

# ---------------------------------------------------------------------------
# Section detection
# ---------------------------------------------------------------------------

_SECTION_RE: dict[str, re.Pattern] = {
    "listening": re.compile(r"聴\s*解|ちょうかい|聞\s*き\s*取り|听\s*解", re.IGNORECASE),
    "reading": re.compile(r"読\s*解|どっかい|読\s*み\s*取り", re.IGNORECASE),
    "grammar": re.compile(r"文\s*法|ぶんぽう|文の文法|言語知識.*文法", re.IGNORECASE),
    "vocabulary": re.compile(r"語\s*彙|文字|ことば|言語知識.*語彙|もじ", re.IGNORECASE),
}

# Order matters: listening > reading > grammar > vocabulary
_SECTION_PRIORITY = ["listening", "reading", "grammar", "vocabulary"]

# ---------------------------------------------------------------------------
# Question / option patterns
# ---------------------------------------------------------------------------

# Matches: 問1 / 問２ / [1] / (1) / 1. / 1） / ① etc. at start of line
_QUESTION_START_RE = re.compile(
    r"(?:^|\n)"
    r"\s*"
    r"(?:"
    r"問\s*[０-９\d]+"           # 問1, 問２
    r"|[(\[（【][０-９\d]+[)\]）】]"  # [1], (1), （1）
    r"|[０-９\d]{1,2}[．.、。)）]"    # 1., 1）, 2。
    r"|[①②③④⑤⑥⑦⑧⑨⑩]"           # ①–⑩ as question markers
    r")"
    r"\s*",
    re.MULTILINE,
)

# Option patterns tried in order
_OPTION_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("circled",  re.compile(r"([①②③④])\s*(.+?)(?=\n[①②③④]|\Z)", re.DOTALL)),
    ("katakana", re.compile(r"^([アイウエ])[．.、。\s]\s*(.+?)$", re.MULTILINE)),
    ("alpha",    re.compile(r"^([ABCDabcd])[．.、。\s]\s*(.+?)$", re.MULTILINE)),
    ("numeric",  re.compile(r"^([1-4１２３４])[．.、。\s]\s*(.+?)$", re.MULTILINE)),
]

_CIRCLED_LABEL_MAP = {"①": "A", "②": "B", "③": "C", "④": "D"}
_KANA_LABEL_MAP = {"ア": "A", "イ": "B", "ウ": "C", "エ": "D"}

# Full-width → half-width digit table
_FW_TABLE = str.maketrans("０１２３４５６７８９", "0123456789")

# Fill-blank indicator
_FILL_BLANK_RE = re.compile(r"[（(]\s*[＿_]{1,5}\s*[)）]|___+|\[　\]|\[___\]")

# Sentence arrangement hint (e.g. ★ marker used in JLPT bunpo-form)
_ARRANGE_RE = re.compile(r"★|＊{2,}|□.*□")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _normalize(text: str) -> str:
    return text.translate(_FW_TABLE).strip()


def _detect_section(line: str) -> str | None:
    for sec in _SECTION_PRIORITY:
        if _SECTION_RE[sec].search(line):
            return sec
    return None


def _extract_options(block: str) -> list[dict[str, str]]:
    for name, pattern in _OPTION_PATTERNS:
        matches = pattern.findall(block)
        if len(matches) >= 2:
            options: list[dict[str, str]] = []
            for raw_label, text in matches:
                if name == "circled":
                    label = _CIRCLED_LABEL_MAP.get(raw_label, raw_label)
                elif name == "katakana":
                    label = _KANA_LABEL_MAP.get(raw_label, raw_label)
                else:
                    label = raw_label.upper()
                options.append({"label": label, "text": text.strip()})
            return options
    return []


def _question_type(question_text: str, options: list) -> str:
    if _ARRANGE_RE.search(question_text):
        return "sentence_arrange"
    if _FILL_BLANK_RE.search(question_text) and not options:
        return "fill_blank"
    return "multiple_choice"


def _strip_options_from_text(text: str) -> str:
    for _, pattern in _OPTION_PATTERNS:
        text = pattern.sub("", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def split_into_sections(text: str) -> dict[str, list[str]]:
    """Return {section: [lines]} mapping."""
    sections: dict[str, list[str]] = {}
    current = "vocabulary"  # default section

    for line in text.splitlines():
        detected = _detect_section(line)
        if detected:
            current = detected
        sections.setdefault(current, []).append(line)

    return sections


def parse_questions(text: str) -> list[dict[str, Any]]:
    """
    Parse raw OCR text and return a list of structured question dicts.
    Each dict has keys: section, order, question_text, options, question_type.
    """
    section_lines = split_into_sections(text)
    parsed: list[dict[str, Any]] = []
    global_order = 1

    for section, lines in section_lines.items():
        block = "\n".join(lines)
        # Split block at each question boundary
        parts = _QUESTION_START_RE.split(block)

        # parts[0] is pre-first-question text (section heading etc.), skip it
        # Remaining parts are question bodies
        for body in parts[1:]:
            body = body.strip()
            if len(body) < 4:
                continue

            options = _extract_options(body)
            question_text = _strip_options_from_text(body)
            question_text = _normalize(question_text)[:1000]

            if len(question_text) < 3:
                continue

            parsed.append({
                "section": section,
                "order": global_order,
                "question_text": question_text,
                "options": options,
                "question_type": _question_type(question_text, options),
            })
            global_order += 1

    return parsed
