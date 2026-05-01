from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("flashcards", "0004_add_fsrs_and_srs_algo"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ImportLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("content_type", models.CharField(
                    choices=[
                        ("kanji", "Kanji"), ("vocab", "Vocabulary"), ("grammar", "Grammar"),
                        ("reading", "Reading"), ("listening", "Listening"), ("flashcard", "Flashcard"),
                    ],
                    max_length=20,
                )),
                ("filename", models.CharField(blank=True, max_length=255)),
                ("file_format", models.CharField(blank=True, max_length=10)),
                ("rows_imported", models.PositiveIntegerField(default=0)),
                ("rows_skipped", models.PositiveIntegerField(default=0)),
                ("rows_updated", models.PositiveIntegerField(default=0)),
                ("extra", models.JSONField(blank=True, default=dict)),
                ("imported_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="import_logs",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "ordering": ["-imported_at"],
            },
        ),
        migrations.AddIndex(
            model_name="importlog",
            index=models.Index(fields=["user", "-imported_at"], name="flashcards__user_id_imported_idx"),
        ),
    ]
