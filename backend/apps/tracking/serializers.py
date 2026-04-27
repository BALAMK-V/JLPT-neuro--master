from rest_framework import serializers

from .models import Session, UserProgress


class UserProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProgress
        fields = [
            "id",
            "item_type",
            "item_id",
            "accuracy",
            "attempts",
            "correct_attempts",
            "repetitions",
            "interval_days",
            "ease_factor",
            "last_reviewed",
            "next_review_date",
            "last_result_correct",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "accuracy",
            "attempts",
            "correct_attempts",
            "repetitions",
            "interval_days",
            "ease_factor",
            "last_reviewed",
            "next_review_date",
            "last_result_correct",
            "created_at",
            "updated_at",
        ]


class ReviewApplySerializer(serializers.Serializer):
    correct = serializers.BooleanField()


class SessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = [
            "id",
            "goal_type",
            "goal_target",
            "progress_count",
            "started_at",
            "ended_at",
            "duration_seconds",
            "reflection",
            "summary",
        ]

    def create(self, validated_data):  # type: ignore[no-untyped-def]
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)
