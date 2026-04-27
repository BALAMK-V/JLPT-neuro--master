from django.db import models

from apps.content.models import JLPTLevel


class GrammarQuestion(models.Model):
    class Section(models.TextChoices):
        BUNPO_FORM = "bunpo_form", "文法形式の判断"
        SENTENCE_BUILD = "sentence_build", "文の組み立て"
        TEXT_GRAMMAR = "text_grammar", "文章の文法"
        OTHER = "other", "Other"

    class QuestionType(models.TextChoices):
        CHOOSE = "choose", "Choose best"
        FILL_BLANK = "fill_blank", "Fill blank"
        REORDER = "reorder", "Reorder"
        ERROR_FIND = "error_find", "Find error"
        OTHER = "other", "Other"

    jlpt_level = models.CharField(max_length=2, choices=JLPTLevel.choices, default=JLPTLevel.N2)
    section = models.CharField(max_length=30, choices=Section.choices, default=Section.OTHER)
    question_type = models.CharField(max_length=30, choices=QuestionType.choices, default=QuestionType.CHOOSE)

    context_text_jp = models.TextField(blank=True)
    prompt = models.TextField()

    option_a = models.CharField(max_length=255)
    option_b = models.CharField(max_length=255)
    option_c = models.CharField(max_length=255)
    option_d = models.CharField(max_length=255)
    answer = models.CharField(max_length=1)  # A-D
    explanation = models.TextField(blank=True)

    tags = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["jlpt_level", "section"]),
            models.Index(fields=["jlpt_level", "question_type"]),
        ]

    def __str__(self) -> str:
        return f"GrammarQuestion({self.id})"
