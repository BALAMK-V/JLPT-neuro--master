from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notes", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="note",
            name="title",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="note",
            name="color",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="note",
            name="pinned",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="note",
            name="archived",
            field=models.BooleanField(default=False),
        ),
    ]
