from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("content", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Deck",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                (
                    "deck_type",
                    models.CharField(choices=[("kanji", "Kanji"), ("vocab", "Vocabulary"), ("custom", "Custom")], default="custom", max_length=20),
                ),
                (
                    "jlpt_level",
                    models.CharField(choices=[("N5", "N5"), ("N4", "N4"), ("N3", "N3"), ("N2", "N2"), ("N1", "N1")], default="N2", max_length=2),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="flash_decks", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "unique_together": {("user", "name")},
                "indexes": [
                    models.Index(fields=["user", "deck_type"], name="flashcards_d_user_id_4fb0d2_idx"),
                    models.Index(fields=["user", "jlpt_level"], name="flashcards_d_user_id_3dcfbb_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Card",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("front", models.TextField()),
                ("back", models.TextField()),
                ("tags", models.JSONField(blank=True, default=list)),
                ("suspended", models.BooleanField(default=False)),
                ("repetitions", models.PositiveIntegerField(default=0)),
                ("interval_days", models.PositiveIntegerField(default=0)),
                ("ease_factor", models.FloatField(default=2.5)),
                ("due_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("last_reviewed", models.DateTimeField(blank=True, null=True)),
                ("lapses", models.PositiveIntegerField(default=0)),
                ("last_rating", models.CharField(blank=True, max_length=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "deck",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="cards", to="flashcards.deck"),
                ),
                (
                    "kanji",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="flash_cards", to="content.kanji"),
                ),
                (
                    "vocab",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="flash_cards", to="content.vocabulary"),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["deck", "due_at"], name="flashcards_c_deck_id_73eb1c_idx"),
                    models.Index(fields=["deck", "suspended"], name="flashcards_c_deck_id_62f114_idx"),
                ],
            },
        ),
    ]

