from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="display_name",
            field=models.CharField(blank=True, default="", max_length=60),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="nickname",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="avatar_config",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="avatar_url",
            field=models.URLField(blank=True, default=""),
        ),
    ]
