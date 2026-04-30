from rest_framework import serializers

from .models import QuestionPaper


class QuestionPaperSerializer(serializers.ModelSerializer):
    question_count = serializers.IntegerField(read_only=True)
    uploaded_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = QuestionPaper
        fields = [
            "id",
            "uploaded_by",
            "file",
            "file_type",
            "original_filename",
            "level",
            "status",
            "extracted_text",
            "parsed_questions",
            "ai_parsed_questions",
            "question_count",
            "error_message",
            "created_at",
            "processed_at",
        ]
        read_only_fields = [
            "status",
            "extracted_text",
            "parsed_questions",
            "question_count",
            "error_message",
            "created_at",
            "processed_at",
        ]


class UpdateParsedQuestionsSerializer(serializers.Serializer):
    """Accepts the full edited question list to save back to the paper."""

    questions = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=True,
    )


class PaperUploadSerializer(serializers.Serializer):
    """Minimal serializer for the upload endpoint."""

    file = serializers.FileField()
    level = serializers.ChoiceField(choices=["N5", "N4", "N3", "N2", "N1"], default="N3")


class ImportConfirmSerializer(serializers.Serializer):
    """
    Confirm parsed questions from a processed paper to import into a JLPTExam.
    """

    paper_id = serializers.IntegerField()
    exam_id = serializers.IntegerField(required=False, allow_null=True)
    exam_title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    question_indices = serializers.ListField(
        child=serializers.IntegerField(min_value=0),
        required=False,
        allow_empty=True,
        help_text="0-based indices of parsed_questions to import. Empty = import all.",
    )
