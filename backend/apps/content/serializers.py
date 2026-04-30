from rest_framework import serializers

from .models import Kanji, KanjiExample, Vocabulary


class KanjiExampleSerializer(serializers.ModelSerializer):
    class Meta:
        model = KanjiExample
        fields = ["id", "sentence_jp", "sentence_en"]


class KanjiSerializer(serializers.ModelSerializer):
    examples = KanjiExampleSerializer(many=True, required=False)

    class Meta:
        model = Kanji
        fields = ["id", "character", "onyomi", "kunyomi", "meaning_en", "jlpt_level", "examples"]

    def create(self, validated_data):  # type: ignore[no-untyped-def]
        examples_data = validated_data.pop("examples", [])
        kanji = Kanji.objects.create(**validated_data)
        for ex in examples_data:
            KanjiExample.objects.create(kanji=kanji, **ex)
        return kanji

    def update(self, instance, validated_data):  # type: ignore[no-untyped-def]
        examples_data = validated_data.pop("examples", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if examples_data is not None:
            instance.examples.all().delete()
            for ex in examples_data:
                KanjiExample.objects.create(kanji=instance, **ex)
        return instance


class VocabularySerializer(serializers.ModelSerializer):
    related_kanji_ids = serializers.PrimaryKeyRelatedField(
        many=True, source="related_kanji", queryset=Kanji.objects.all(), required=False
    )

    class Meta:
        model = Vocabulary
        fields = ["id", "word", "reading", "meaning_en", "jlpt_level", "frequency_rank", "related_kanji_ids"]
