from rest_framework import serializers

from apps.content.models import Kanji, Vocabulary

from .models import Card, Deck, ImportLog


class DeckSerializer(serializers.ModelSerializer):
    due_count = serializers.IntegerField(read_only=True)
    total_cards = serializers.IntegerField(read_only=True)

    class Meta:
        model = Deck
        fields = [
            "id",
            "name",
            "deck_type",
            "jlpt_level",
            "system_key",
            "is_locked",
            "srs_algo",
            "created_at",
            "updated_at",
            "due_count",
            "total_cards",
        ]


class CardSerializer(serializers.ModelSerializer):
    kanji_character = serializers.CharField(source="kanji.character", read_only=True, default="")
    kanji_onyomi = serializers.CharField(source="kanji.onyomi", read_only=True, default="")
    kanji_kunyomi = serializers.CharField(source="kanji.kunyomi", read_only=True, default="")
    kanji_meaning = serializers.CharField(source="kanji.meaning_en", read_only=True, default="")
    vocab_word = serializers.CharField(source="vocab.word", read_only=True, default="")
    vocab_reading_detail = serializers.CharField(source="vocab.reading", read_only=True, default="")
    vocab_meaning = serializers.CharField(source="vocab.meaning_en", read_only=True, default="")

    class Meta:
        model = Card
        fields = [
            "id",
            "deck",
            "kanji",
            "kanji_character",
            "kanji_onyomi",
            "kanji_kunyomi",
            "kanji_meaning",
            "vocab",
            "vocab_word",
            "vocab_reading_detail",
            "vocab_meaning",
            "front",
            "back",
            "furigana",
            "image",
            "audio",
            "tags",
            "suspended",
            "repetitions",
            "interval_days",
            "ease_factor",
            "due_at",
            "last_reviewed",
            "lapses",
            "last_rating",
            "fsrs_stability",
            "fsrs_difficulty",
            "fsrs_state",
            "created_at",
            "updated_at",
        ]


class ReviewApplySerializer(serializers.Serializer):
    card_id = serializers.IntegerField()
    rating = serializers.ChoiceField(choices=[c for c, _ in Card.Rating.choices])


class FlashImportSerializer(serializers.Serializer):
    # Used only for documenting/validating request keys; actual import uses multipart parsing.
    deck_id = serializers.IntegerField(required=False)
    deck_name = serializers.CharField(required=False)
    deck_type = serializers.ChoiceField(choices=[c for c, _ in Deck.DeckType.choices], required=False)


class ImportLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportLog
        fields = [
            "id", "content_type", "filename", "file_format",
            "rows_imported", "rows_skipped", "rows_updated",
            "extra", "imported_at",
        ]
        read_only_fields = fields
