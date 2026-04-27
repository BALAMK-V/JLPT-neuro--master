from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userprofile",
            name="learning_type",
            field=models.CharField(
                choices=[
                    ("balanced", "Balanced"),
                    ("focus_support", "Focus Support"),
                    ("calm_structure", "Calm Structure"),
                ],
                default="balanced",
                max_length=24,
            ),
        ),
    ]
