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
            name="UserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "learning_type",
                    models.CharField(
                        choices=[("balanced", "Balanced"), ("focus_support", "Focus Support"), ("calm_structure", "Calm Structure")],
                        default="balanced",
                        max_length=24,
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
                ("daily_goal_new_items", models.PositiveIntegerField(default=20)),
                ("session_minutes_preference", models.PositiveIntegerField(default=10)),
                ("reminders_enabled", models.BooleanField(default=True)),
                ("reminder_interval_minutes", models.PositiveIntegerField(default=25)),
                ("ui_prefs", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
