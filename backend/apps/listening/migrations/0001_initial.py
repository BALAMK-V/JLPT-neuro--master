from django.db import migrations, models


def listening_audio_path(instance, filename: str) -> str:
    return f"listening/audio/{filename}"


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="ListeningQuestion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("audio_file", models.FileField(blank=True, null=True, upload_to=listening_audio_path)),
                ("audio_filename", models.CharField(blank=True, max_length=255)),
                ("question", models.TextField()),
                ("option_a", models.CharField(max_length=255)),
                ("option_b", models.CharField(max_length=255)),
                ("option_c", models.CharField(max_length=255)),
                ("option_d", models.CharField(max_length=255)),
                ("answer", models.CharField(max_length=1)),
                ("explanation", models.TextField(blank=True)),
                (
                    "jlpt_level",
                    models.CharField(
                        choices=[("N5", "N5"), ("N4", "N4"), ("N3", "N3"), ("N2", "N2"), ("N1", "N1")],
                        default="N2",
                        max_length=2,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "indexes": [models.Index(fields=["jlpt_level"], name="listening_l_jlpt_le_b5c873_idx")],
            },
        ),
    ]
