import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("content", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="QuestionPaper",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to="ocr/uploads/")),
                ("file_type", models.CharField(choices=[("image", "Image (JPG/PNG/BMP/TIFF)"), ("pdf", "PDF")], max_length=10)),
                ("original_filename", models.CharField(blank=True, max_length=255)),
                ("level", models.CharField(choices=[("N5", "N5"), ("N4", "N4"), ("N3", "N3"), ("N2", "N2"), ("N1", "N1")], default="N3", max_length=2)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("processing", "Processing"), ("completed", "Completed"), ("failed", "Failed")], default="pending", max_length=20)),
                ("extracted_text", models.TextField(blank=True)),
                ("parsed_questions", models.JSONField(blank=True, default=list)),
                ("error_message", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
                ("uploaded_by", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="uploaded_papers", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
