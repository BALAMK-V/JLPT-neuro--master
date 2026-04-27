from rest_framework import serializers

from .models import ListeningQuestion


class ListeningQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListeningQuestion
        fields = [
            "id",
            "audio_file",
            "audio_filename",
            "section",
            "question_type",
            "audio_text",
            "question",
            "option_a",
            "option_b",
            "option_c",
            "option_d",
            "answer",
            "explanation",
            "jlpt_level",
            "created_at",
        ]

    def validate_answer(self, value: str) -> str:
        value = (value or "").strip().upper()
        if value not in {"A", "B", "C", "D"}:
            raise serializers.ValidationError("Answer must be one of A, B, C, D.")
        return value
