from rest_framework import serializers

from .models import ReadingPassage, ReadingQuestion


class ReadingQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReadingQuestion
        fields = [
            "id",
            "passage",
            "order",
            "question_type",
            "question",
            "option_a",
            "option_b",
            "option_c",
            "option_d",
            "answer",
            "explanation",
            "created_at",
        ]

    def validate_answer(self, value: str) -> str:
        value = (value or "").strip().upper()
        if value not in {"A", "B", "C", "D"}:
            raise serializers.ValidationError("Answer must be one of A, B, C, D.")
        return value


class ReadingPassageSerializer(serializers.ModelSerializer):
    questions = ReadingQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = ReadingPassage
        fields = [
            "id",
            "title",
            "passage_type",
            "jlpt_level",
            "text_jp",
            "text_en",
            "source",
            "tags",
            "created_at",
            "updated_at",
            "questions",
        ]
