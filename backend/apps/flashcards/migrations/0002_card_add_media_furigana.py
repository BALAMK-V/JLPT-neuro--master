from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("flashcards", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="card",
            name="furigana",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="card",
            name="image",
            field=models.URLField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="card",
            name="audio",
            field=models.URLField(blank=True, default="", max_length=500),
        ),
    ]
