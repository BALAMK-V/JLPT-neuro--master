from django.db import models


class JLPTLevel(models.TextChoices):
    N5 = "N5", "N5"
    N4 = "N4", "N4"
    N3 = "N3", "N3"
    N2 = "N2", "N2"
    N1 = "N1", "N1"


class Kanji(models.Model):
    character = models.CharField(max_length=1, unique=True)
    onyomi = models.CharField(max_length=200, blank=True)
    kunyomi = models.CharField(max_length=200, blank=True)
    meaning_en = models.CharField(max_length=255)
    jlpt_level = models.CharField(max_length=2, choices=JLPTLevel.choices, default=JLPTLevel.N2)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.character


class KanjiExample(models.Model):
    kanji = models.ForeignKey(Kanji, on_delete=models.CASCADE, related_name="examples")
    sentence_jp = models.TextField()
    sentence_en = models.TextField(blank=True)

    def __str__(self) -> str:
        return f"Example({self.kanji.character})"


class Vocabulary(models.Model):
    word = models.CharField(max_length=120)
    reading = models.CharField(max_length=120, blank=True)
    meaning_en = models.CharField(max_length=255)
    jlpt_level = models.CharField(max_length=2, choices=JLPTLevel.choices, default=JLPTLevel.N2)
    related_kanji = models.ManyToManyField(Kanji, blank=True, related_name="vocabulary")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["jlpt_level"]),
            models.Index(fields=["word"]),
        ]

    def __str__(self) -> str:
        return self.word
