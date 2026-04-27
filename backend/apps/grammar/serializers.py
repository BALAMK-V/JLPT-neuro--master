from rest_framework import serializers

from .models import GrammarQuestion


class GrammarQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = GrammarQuestion
        fields = [
            "id",
            "jlpt_level",
            "section",
            "question_type",
            "context_text_jp",
            "prompt",
            "option_a",
            "option_b",
            "option_c",
            "option_d",
            "answer",
            "explanation",
            "tags",
            "created_at",
        ]

    def validate_answer(self, value: str) -> str:
        v = (value or "").strip().upper()
        if v not in {"A", "B", "C", "D"}:
            raise serializers.ValidationError("Answer must be one of A, B, C, D.")
        return v
