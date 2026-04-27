from django.conf import settings
from django.db import models


class NeuroQuestion(models.Model):
    class QuestionType(models.TextChoices):
        SCALE = "scale", "Scale"
        MCQ = "mcq", "Multiple choice"

    question_text = models.TextField()
    type = models.CharField(max_length=12, choices=QuestionType.choices, default=QuestionType.SCALE)
    order = models.PositiveIntegerField(default=0)
    trait_key = models.CharField(max_length=40, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.order}. {self.question_text[:60]}"


class NeuroOption(models.Model):
    question = models.ForeignKey(NeuroQuestion, on_delete=models.CASCADE, related_name="options")
    text = models.CharField(max_length=180)
    value = models.PositiveSmallIntegerField(default=0)
    weight_mapping = models.JSONField(default=dict)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.question_id}: {self.text}"


class UserNeuroProfile(models.Model):
    class ResultType(models.TextChoices):
        BALANCED = "balanced", "Balanced learner"
        QUICK_RESET = "quick_reset", "Quick Reset learner"
        FOCUS_SUPPORT = "focus_support", "Focus Support learner"
        MOMENTUM_SUPPORT = "momentum_support", "Momentum Support learner"
        CALM_STRUCTURE = "calm_structure", "Calm Structure learner"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="neuro_profile")
    result_type = models.CharField(max_length=32, choices=ResultType.choices)
    trait_scores = models.JSONField(default=dict)
    summary = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"NeuroProfile({self.user_id}, {self.result_type})"


class UserNeuroAnswer(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="neuro_answers")
    question = models.ForeignKey(NeuroQuestion, on_delete=models.CASCADE)
    selected_option = models.ForeignKey(NeuroOption, on_delete=models.PROTECT)
    score = models.JSONField(default=dict)
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "question"]),
            models.Index(fields=["user", "answered_at"]),
        ]

    def __str__(self) -> str:
        return f"NeuroAnswer({self.user_id}, {self.question_id})"
