from rest_framework import serializers

from .models import Test, TestQuestion


class TestQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestQuestion
        fields = [
            "id",
            "test",
            "order",
            "item_type",
            "item_id",
            "prompt",
            "choices",
            "correct_answer",
            "explanation",
        ]


class TestSerializer(serializers.ModelSerializer):
    questions = TestQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Test
        fields = [
            "id",
            "title",
            "test_type",
            "jlpt_level",
            "timed",
            "duration_seconds",
            "is_published",
            "created_by",
            "created_at",
            "questions",
        ]
        read_only_fields = ["created_by", "created_at"]

    def create(self, validated_data):  # type: ignore[no-untyped-def]
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        return super().create(validated_data)
