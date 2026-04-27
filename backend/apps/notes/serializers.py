from rest_framework import serializers

from .models import Note


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ["id", "note_type", "reference_type", "reference_id", "content", "created_at", "updated_at"]

    def create(self, validated_data):  # type: ignore[no-untyped-def]
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)
