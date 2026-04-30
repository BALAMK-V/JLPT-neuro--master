from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.content.models import JLPTLevel


class JLPTExam(models.Model):
    """Official-style JLPT exam with multimedia question support."""

    class SectionType(models.TextChoices):
        LANGUAGE_KNOWLEDGE = "language_knowledge", "Language Knowledge (Vocab + Grammar)"
        READING = "reading", "Reading"
        LISTENING = "listening", "Listening"
        FULL = "full", "Full Exam"

    level = models.CharField(max_length=2, choices=JLPTLevel.choices, default=JLPTLevel.N3)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    section_type = models.CharField(max_length=30, choices=SectionType.choices, default=SectionType.FULL)
    duration_minutes = models.PositiveIntegerField(default=105)
    is_official_style = models.BooleanField(default=True)
    is_published = models.BooleanField(default=False)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_exams",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["level", "is_published"])]

    def __str__(self) -> str:
        return f"{self.level} — {self.title}"

    @property
    def question_count(self) -> int:
        return self.questions.count()


class ExamQuestion(models.Model):
    """A single question within a JLPT exam supporting text, image, and audio."""

    class Section(models.TextChoices):
        VOCABULARY = "vocabulary", "Vocabulary"
        GRAMMAR = "grammar", "Grammar"
        READING = "reading", "Reading"
        LISTENING = "listening", "Listening"

    class QuestionType(models.TextChoices):
        MULTIPLE_CHOICE = "multiple_choice", "Multiple Choice"
        IMAGE_BASED = "image_based", "Image-Based"
        AUDIO_BASED = "audio_based", "Audio-Based"
        FILL_BLANK = "fill_blank", "Fill in the Blank"
        SENTENCE_ARRANGE = "sentence_arrange", "Sentence Arrangement"

    exam = models.ForeignKey(JLPTExam, on_delete=models.CASCADE, related_name="questions")
    order = models.PositiveIntegerField(default=0)
    section = models.CharField(max_length=20, choices=Section.choices)
    question_type = models.CharField(
        max_length=30, choices=QuestionType.choices, default=QuestionType.MULTIPLE_CHOICE
    )

    question_text = models.TextField()
    question_image = models.ImageField(upload_to="exam/questions/images/", null=True, blank=True)
    audio_file = models.FileField(upload_to="exam/questions/audio/", null=True, blank=True)
    # Passage shown above a group of reading questions
    passage_text = models.TextField(blank=True)

    points = models.PositiveIntegerField(default=1)
    explanation = models.TextField(blank=True)

    class Meta:
        ordering = ["order", "id"]
        indexes = [
            models.Index(fields=["exam", "section"]),
            models.Index(fields=["exam", "order"]),
        ]

    def __str__(self) -> str:
        return f"Q{self.order}: {self.question_text[:60]}"


class ExamOption(models.Model):
    """One answer option for a multiple-choice ExamQuestion."""

    question = models.ForeignKey(ExamQuestion, on_delete=models.CASCADE, related_name="options")
    label = models.CharField(max_length=5)  # A / B / C / D
    text = models.TextField(blank=True)
    image = models.ImageField(upload_to="exam/options/images/", null=True, blank=True)
    is_correct = models.BooleanField(default=False)

    class Meta:
        ordering = ["label"]

    def __str__(self) -> str:
        return f"{self.label}: {self.text[:50]}"


class UserExamSession(models.Model):
    """Tracks one active or completed exam attempt."""

    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In Progress"
        SUBMITTED = "submitted", "Submitted"
        ABANDONED = "abandoned", "Abandoned"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="exam_sessions"
    )
    exam = models.ForeignKey(JLPTExam, on_delete=models.CASCADE, related_name="user_sessions")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_PROGRESS)
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    time_remaining_seconds = models.IntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["user", "exam"]),
        ]

    def __str__(self) -> str:
        return f"ExamSession(user={self.user_id}, exam={self.exam_id}, {self.status})"


class UserQuestionAnswer(models.Model):
    """Records a user's answer to one question inside an exam session."""

    session = models.ForeignKey(UserExamSession, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(ExamQuestion, on_delete=models.CASCADE, related_name="user_answers")
    selected_option = models.ForeignKey(
        ExamOption, on_delete=models.SET_NULL, null=True, blank=True, related_name="selected_by"
    )
    text_answer = models.TextField(blank=True)

    is_correct = models.BooleanField(default=False)
    time_taken_seconds = models.PositiveIntegerField(default=0)
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("session", "question")
        indexes = [models.Index(fields=["session", "question"])]

    def __str__(self) -> str:
        return f"Answer(session={self.session_id}, q={self.question_id}, correct={self.is_correct})"


class ExamResult(models.Model):
    """
    Final exam result with section-wise scores, weak area detection,
    and personalised study suggestions.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="exam_results"
    )
    exam = models.ForeignKey(JLPTExam, on_delete=models.CASCADE, related_name="results")
    session = models.OneToOneField(UserExamSession, on_delete=models.CASCADE, related_name="result")

    total_questions = models.PositiveIntegerField(default=0)
    correct_answers = models.PositiveIntegerField(default=0)
    score_percentage = models.FloatField(default=0.0)
    time_taken_seconds = models.PositiveIntegerField(default=0)

    # {"vocabulary": {"total": 20, "correct": 15, "percentage": 75.0}, ...}
    section_scores = models.JSONField(default=dict)

    # ["Vocabulary confusion — difficulty ...", "Grammar pattern mistakes — ..."]
    weak_areas = models.JSONField(default=list)

    # ["Focus on grammar patterns (〜ている, 〜ように)", ...]
    study_suggestions = models.JSONField(default=list)

    passed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "exam"]),
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"Result(user={self.user_id}, exam={self.exam_id}, {self.score_percentage:.1f}%)"
