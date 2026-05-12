from __future__ import annotations

from django.conf import settings
from django.db import models


class QuizGame(models.Model):
    code = models.CharField(max_length=8, db_index=True)
    level = models.CharField(max_length=2)
    players = models.JSONField(default=list)
    questions = models.JSONField(default=list)
    rounds = models.JSONField(default=list)
    winner_id = models.PositiveBigIntegerField(null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self) -> str:
        return f"QuizGame({self.code}, {self.level})"


class QuizPlayerStat(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="quiz_stats")
    game = models.ForeignKey(QuizGame, on_delete=models.CASCADE, related_name="player_stats")
    score = models.PositiveIntegerField(default=0)
    correct_count = models.PositiveIntegerField(default=0)
    total_count = models.PositiveIntegerField(default=0)
    avg_response_time_ms = models.FloatField(default=0.0)
    rank = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("user", "game")

    def __str__(self) -> str:
        return f"QuizStat({self.user_id}, game={self.game_id}, rank={self.rank})"
