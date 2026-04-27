from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="ReadingPassage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                (
                    "passage_type",
                    models.CharField(
                        choices=[
                            ("short", "Short passage"),
                            ("medium", "Medium passage"),
                            ("long", "Long passage"),
                            ("integrated", "Integrated comprehension"),
                            ("info_search", "Information search"),
                        ],
                        default="medium",
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
                ("text_jp", models.TextField()),
                ("text_en", models.TextField(blank=True)),
                ("source", models.CharField(blank=True, max_length=255)),
                ("tags", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "indexes": [
                    models.Index(fields=["jlpt_level", "passage_type"], name="reading_pas_jlpt_le_3f2c8a_idx"),
                    models.Index(fields=["title"], name="reading_pas_title_08b644_idx"),
                ]
            },
        ),
        migrations.CreateModel(
            name="ReadingQuestion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order", models.PositiveIntegerField(default=0)),
                ("question", models.TextField()),
                ("option_a", models.CharField(max_length=255)),
                ("option_b", models.CharField(max_length=255)),
                ("option_c", models.CharField(max_length=255)),
                ("option_d", models.CharField(max_length=255)),
                ("answer", models.CharField(max_length=1)),
                ("explanation", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "passage",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="questions", to="reading.readingpassage"),
                ),
            ],
            options={
                "ordering": ["order", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="readingquestion",
            index=models.Index(fields=["passage", "order"], name="reading_que_passage_72e47f_idx"),
        ),
    ]
