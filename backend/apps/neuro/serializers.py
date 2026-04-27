from rest_framework import serializers

from .models import NeuroOption, NeuroQuestion, UserNeuroProfile


class NeuroOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = NeuroOption
        fields = ["id", "text", "value", "weight_mapping", "order"]


class NeuroQuestionSerializer(serializers.ModelSerializer):
    options = NeuroOptionSerializer(many=True, read_only=True)

    class Meta:
        model = NeuroQuestion
        fields = ["id", "question_text", "type", "order", "trait_key", "options"]


class NeuroSubmitAnswerSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    option_id = serializers.IntegerField()


class NeuroSubmitSerializer(serializers.Serializer):
    answers = NeuroSubmitAnswerSerializer(many=True, min_length=1)


class UserNeuroProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserNeuroProfile
        fields = ["result_type", "trait_scores", "summary", "created_at", "updated_at"]
