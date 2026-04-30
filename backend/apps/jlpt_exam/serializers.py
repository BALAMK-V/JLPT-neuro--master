from rest_framework import serializers

from .models import ExamOption, ExamQuestion, ExamResult, JLPTExam, UserExamSession, UserQuestionAnswer


class ExamOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamOption
        fields = ["id", "label", "text", "image", "is_correct"]


class ExamOptionPublicSerializer(serializers.ModelSerializer):
    """Option serializer that hides the correct answer during an active exam."""

    class Meta:
        model = ExamOption
        fields = ["id", "label", "text", "image"]


class ExamQuestionSerializer(serializers.ModelSerializer):
    options = ExamOptionPublicSerializer(many=True, read_only=True)

    class Meta:
        model = ExamQuestion
        fields = [
            "id",
            "order",
            "section",
            "question_type",
            "question_text",
            "question_image",
            "audio_file",
            "passage_text",
            "points",
            "options",
        ]


class ExamQuestionWithAnswerSerializer(ExamQuestionSerializer):
    """Includes correct answer info — for post-submission review only."""

    options = ExamOptionSerializer(many=True, read_only=True)

    class Meta(ExamQuestionSerializer.Meta):
        fields = ExamQuestionSerializer.Meta.fields + ["explanation"]


class JLPTExamListSerializer(serializers.ModelSerializer):
    question_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = JLPTExam
        fields = [
            "id",
            "level",
            "title",
            "description",
            "section_type",
            "duration_minutes",
            "is_official_style",
            "is_published",
            "question_count",
            "created_at",
        ]


class JLPTExamDetailSerializer(serializers.ModelSerializer):
    questions = ExamQuestionSerializer(many=True, read_only=True)
    question_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = JLPTExam
        fields = [
            "id",
            "level",
            "title",
            "description",
            "section_type",
            "duration_minutes",
            "is_official_style",
            "is_published",
            "question_count",
            "questions",
            "created_at",
        ]

    def create(self, validated_data: dict) -> JLPTExam:
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        return super().create(validated_data)


class UserExamSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserExamSession
        fields = ["id", "exam", "status", "started_at", "submitted_at", "time_remaining_seconds"]
        read_only_fields = ["status", "started_at", "submitted_at"]


class UserQuestionAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserQuestionAnswer
        fields = ["id", "session", "question", "selected_option", "text_answer", "time_taken_seconds"]
        read_only_fields = ["is_correct", "answered_at"]


class BulkAnswerSerializer(serializers.Serializer):
    """Used for submitting all answers at once."""

    answers = UserQuestionAnswerSerializer(many=True)
    time_remaining_seconds = serializers.IntegerField(min_value=0, default=0)


class ExamResultSerializer(serializers.ModelSerializer):
    exam_title = serializers.CharField(source="exam.title", read_only=True)
    exam_level = serializers.CharField(source="exam.level", read_only=True)

    class Meta:
        model = ExamResult
        fields = [
            "id",
            "exam",
            "exam_title",
            "exam_level",
            "session",
            "total_questions",
            "correct_answers",
            "score_percentage",
            "time_taken_seconds",
            "section_scores",
            "weak_areas",
            "study_suggestions",
            "passed",
            "created_at",
        ]
        read_only_fields = fields
