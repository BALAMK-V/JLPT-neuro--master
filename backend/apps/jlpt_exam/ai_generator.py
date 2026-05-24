"""Gemini-powered JLPT exam question generator."""
from __future__ import annotations

import json
import logging

from django.conf import settings
from django.db import transaction

from .models import ExamOption, ExamQuestion, JLPTExam

logger = logging.getLogger(__name__)

SECTION_COUNTS = {
    "vocabulary": 25,
    "grammar": 20,
    "reading": 15,
    "full": 60,
}

SYSTEM_PROMPT = """You are an expert JLPT exam writer. Generate authentic JLPT practice questions.
Return ONLY a valid JSON object — no markdown, no code fences.

JSON shape:
{
  "title": "<descriptive exam title>",
  "questions": [
    {
      "section": "vocabulary" | "grammar" | "reading",
      "question_type": "multiple_choice",
      "question_text": "<question in Japanese with English context if needed>",
      "passage_text": "<reading passage — empty string for vocab/grammar>",
      "options": [
        {"label": "A", "text": "<option text>", "is_correct": false},
        {"label": "B", "text": "<option text>", "is_correct": true},
        {"label": "C", "text": "<option text>", "is_correct": false},
        {"label": "D", "text": "<option text>", "is_correct": false}
      ],
      "explanation": "<why the correct answer is correct, in English>"
    }
  ]
}

Rules:
- Exactly ONE option must have is_correct: true per question
- questions array must have exactly the requested count
- All content must be appropriate for the specified JLPT level
- Vocabulary questions test word meaning, reading, or usage in context
- Grammar questions test sentence patterns appropriate to the JLPT level
- Reading questions must include passage_text (at least 80 characters of Japanese)
- Distractors must be plausible — never obviously wrong
- Return ONLY the JSON object"""

MOCK_QUESTIONS = [
    {
        "section": "vocabulary",
        "question_type": "multiple_choice",
        "question_text": "この映画は世界中で（　　）されています。",
        "passage_text": "",
        "options": [
            {"label": "A", "text": "公開", "is_correct": True},
            {"label": "B", "text": "公式", "is_correct": False},
            {"label": "C", "text": "公共", "is_correct": False},
            {"label": "D", "text": "公正", "is_correct": False},
        ],
        "explanation": "公開 (こうかい) means 'release/showing to the public', fitting the context of a film being shown worldwide.",
    },
    {
        "section": "grammar",
        "question_type": "multiple_choice",
        "question_text": "試験に合格する（　　）、毎日勉強しています。",
        "passage_text": "",
        "options": [
            {"label": "A", "text": "ために", "is_correct": True},
            {"label": "B", "text": "ように", "is_correct": False},
            {"label": "C", "text": "からに", "is_correct": False},
            {"label": "D", "text": "ばかり", "is_correct": False},
        ],
        "explanation": "〜ために expresses purpose with a volitional verb (合格する is intentional), making it the correct choice here.",
    },
    {
        "section": "reading",
        "question_type": "multiple_choice",
        "question_text": "この文章で筆者が最も伝えたいことは何ですか？",
        "passage_text": "現代社会では、スマートフォンの使いすぎが問題になっています。特に若者の間では、一日に何時間もスマートフォンを使う人が増えており、睡眠不足や集中力の低下が報告されています。専門家は、デジタル機器との適切な距離を保つことが健康的な生活に不可欠だと述べています。",
        "options": [
            {"label": "A", "text": "スマートフォンの使いすぎに注意が必要だ", "is_correct": True},
            {"label": "B", "text": "若者はもっとスマートフォンを使うべきだ", "is_correct": False},
            {"label": "C", "text": "デジタル機器はすべて禁止すべきだ", "is_correct": False},
            {"label": "D", "text": "睡眠時間を増やすことが最重要だ", "is_correct": False},
        ],
        "explanation": "The passage discusses the problems caused by excessive smartphone use and the importance of maintaining appropriate distance from digital devices.",
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


def _build_mock_exam(level: str, section: str, count: int, user) -> JLPTExam:
    """Create a realistic mock exam in the database for dev testing."""
    section_type_map = {
        "vocabulary": JLPTExam.SectionType.LANGUAGE_KNOWLEDGE,
        "grammar": JLPTExam.SectionType.LANGUAGE_KNOWLEDGE,
        "reading": JLPTExam.SectionType.READING,
        "full": JLPTExam.SectionType.FULL,
    }
    duration_map = {"vocabulary": 35, "grammar": 35, "reading": 60, "full": 105}

    exam = JLPTExam.objects.create(
        level=level,
        title=f"[Mock] AI-Generated {level} {section.capitalize()} Practice",
        description=f"Dev mock exam — {count} sample questions at {level} level.",
        section_type=section_type_map.get(section, JLPTExam.SectionType.FULL),
        duration_minutes=duration_map.get(section, 60),
        is_official_style=False,
        is_published=True,
        created_by=user,
    )

    # Repeat mock questions to fill the requested count
    questions_pool = MOCK_QUESTIONS * (count // len(MOCK_QUESTIONS) + 1)
    for order, q in enumerate(questions_pool[:count]):
        question = ExamQuestion.objects.create(
            exam=exam,
            order=order,
            section=q["section"],
            question_type=q["question_type"],
            question_text=q["question_text"],
            passage_text=q["passage_text"],
            explanation=q["explanation"],
            points=1,
        )
        for opt in q["options"]:
            ExamOption.objects.create(
                question=question,
                label=opt["label"],
                text=opt["text"],
                is_correct=opt["is_correct"],
            )
    return exam


@transaction.atomic
def generate_exam(level: str, section: str, user) -> JLPTExam:
    """Call Gemini and persist a full exam. Returns the saved JLPTExam."""
    count = SECTION_COUNTS.get(section, 20)

    if getattr(settings, "GEMINI_DEV_MOCK", False):
        logger.info("AI exam generator: using dev mock response")
        return _build_mock_exam(level, section, count, user)

    from google.genai import types

    client = _get_client()
    if client is None:
        raise RuntimeError("google-genai package not installed or GEMINI_API_KEY not set.")

    section_label = section if section != "full" else "vocabulary, grammar, and reading (mix evenly)"
    user_msg = (
        f"Generate {count} {level} JLPT practice questions for the '{section_label}' section.\n"
        f"Target level: {level} (vocabulary and grammar appropriate for {level}).\n"
        f"Return exactly {count} questions in the JSON format specified."
    )

    model_name = getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash-lite")
    try:
        response = client.models.generate_content(
            model=model_name,
            contents=user_msg,
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
        )
        raw = response.text if response.text else "{}"
    except Exception as exc:
        logger.error("AI exam generation error: %s", exc)
        raise RuntimeError(f"Gemini API error: {exc}") from exc

    data = _parse_json(raw)
    if not data or "questions" not in data:
        raise ValueError("AI returned unexpected format — no 'questions' key.")

    questions_data = data["questions"]
    if not questions_data:
        raise ValueError("AI returned 0 questions.")

    section_type_map = {
        "vocabulary": JLPTExam.SectionType.LANGUAGE_KNOWLEDGE,
        "grammar": JLPTExam.SectionType.LANGUAGE_KNOWLEDGE,
        "reading": JLPTExam.SectionType.READING,
        "full": JLPTExam.SectionType.FULL,
    }
    duration_map = {"vocabulary": 35, "grammar": 35, "reading": 60, "full": 105}

    title = data.get("title") or f"AI-Generated {level} {section.capitalize()} Practice"
    exam = JLPTExam.objects.create(
        level=level,
        title=title,
        description=f"Auto-generated by Gemini AI — {count} questions at {level} level.",
        section_type=section_type_map.get(section, JLPTExam.SectionType.FULL),
        duration_minutes=duration_map.get(section, 60),
        is_official_style=False,
        is_published=True,
        created_by=user,
    )

    for order, q in enumerate(questions_data):
        question = ExamQuestion.objects.create(
            exam=exam,
            order=order,
            section=q.get("section", "vocabulary"),
            question_type=q.get("question_type", "multiple_choice"),
            question_text=q.get("question_text", ""),
            passage_text=q.get("passage_text", ""),
            explanation=q.get("explanation", ""),
            points=1,
        )
        for opt in q.get("options", []):
            ExamOption.objects.create(
                question=question,
                label=opt.get("label", "A"),
                text=opt.get("text", ""),
                is_correct=bool(opt.get("is_correct", False)),
            )

    return exam
