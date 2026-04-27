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
            name="Note",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "note_type",
                    models.CharField(choices=[("quick", "Quick"), ("context", "Context"), ("session", "Session")], max_length=20),
                ),
                ("reference_type", models.CharField(blank=True, max_length=30)),
                ("reference_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("content", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notes", to=settings.AUTH_USER_MODEL),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="note",
            index=models.Index(fields=["user", "note_type"], name="notes_note_user_id_1f8baf_idx"),
        ),
        migrations.AddIndex(
            model_name="note",
            index=models.Index(fields=["user", "reference_type", "reference_id"], name="notes_note_user_id_4b0f7d_idx"),
        ),
    ]
