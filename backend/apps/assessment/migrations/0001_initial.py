from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Test",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                (
                    "test_type",
                    models.CharField(
                        choices=[("kanji", "Kanji"), ("vocab", "Vocabulary"), ("listening", "Listening"), ("mixed", "Mixed")],
                        default="mixed",
                        max_length=20,
                    ),
                ),
                (
                    "jlpt_level",
                    models.CharField(
                        choices=[("N5", "N5"), ("N4", "N4"), ("N3", "N3"), ("N2", "N2"), ("N1", "N1")],
                        default="N2",
                        max_length=2,
                    ),
                ),
                ("timed", models.BooleanField(default=False)),
                ("duration_seconds", models.PositiveIntegerField(default=0)),
                ("is_published", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_tests", to=settings.AUTH_USER_MODEL),
                ),
            ],
        ),
        migrations.CreateModel(
            name="TestQuestion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order", models.PositiveIntegerField(default=0)),
                (
                    "item_type",
                    models.CharField(
                        choices=[("kanji", "Kanji"), ("vocab", "Vocabulary"), ("listening", "Listening"), ("custom", "Custom")],
                        default="custom",
                        max_length=20,
                    ),
                ),
                ("item_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("prompt", models.TextField(blank=True)),
                ("choices", models.JSONField(blank=True, default=dict)),
                ("correct_answer", models.CharField(blank=True, max_length=10)),
                ("explanation", models.TextField(blank=True)),
                (
                    "test",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="questions", to="assessment.test"),
                ),
            ],
            options={
                "ordering": ["order", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="testquestion",
            index=models.Index(fields=["test", "order"], name="assessment_t_test_id_47a4a3_idx"),
        ),
    ]
