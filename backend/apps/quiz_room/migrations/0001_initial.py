import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="QuizGame",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(db_index=True, max_length=8)),
                ("level", models.CharField(max_length=2)),
                ("players", models.JSONField(default=list)),
                ("questions", models.JSONField(default=list)),
                ("rounds", models.JSONField(default=list)),
                ("winner_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={"ordering": ["-started_at"]},
        ),
        migrations.CreateModel(
            name="QuizPlayerStat",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("score", models.PositiveIntegerField(default=0)),
                ("correct_count", models.PositiveIntegerField(default=0)),
                ("total_count", models.PositiveIntegerField(default=0)),
                ("avg_response_time_ms", models.FloatField(default=0.0)),
                ("rank", models.PositiveIntegerField(default=0)),
                (
                    "game",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="player_stats",
                        to="quiz_room.quizgame",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="quiz_stats",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"unique_together": {("user", "game")}},
        ),
    ]
