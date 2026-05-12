"""REST views for quiz replay and history."""
from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import QuizGame, QuizPlayerStat


class QuizHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request) -> Response:  # type: ignore[no-untyped-def]
        stats = (
            QuizPlayerStat.objects.filter(user=request.user)
            .select_related("game")
            .order_by("-game__started_at")[:50]
        )
        data = [
            {
                "game_id": s.game_id,
                "code": s.game.code,
                "level": s.game.level,
                "started_at": s.game.started_at.isoformat(),
                "ended_at": s.game.ended_at.isoformat() if s.game.ended_at else None,
                "score": s.score,
                "correct_count": s.correct_count,
                "total_count": s.total_count,
                "avg_response_time_ms": s.avg_response_time_ms,
                "rank": s.rank,
                "player_count": len(s.game.players),
            }
            for s in stats
        ]
        return Response(data)


class QuizReplayView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, game_id: int) -> Response:  # type: ignore[no-untyped-def]
        try:
            game = QuizGame.objects.get(id=game_id)
        except QuizGame.DoesNotExist:
            return Response({"detail": "Game not found."}, status=status.HTTP_404_NOT_FOUND)

        # Strip correct_id from questions for security (reveal only via rounds)
        questions_safe = [
            {k: v for k, v in q.items() if k != "correct_id"}
            for q in game.questions
        ]

        return Response({
            "id": game.id,
            "code": game.code,
            "level": game.level,
            "players": game.players,
            "questions": questions_safe,
            "rounds": game.rounds,
            "winner_id": game.winner_id,
            "started_at": game.started_at.isoformat(),
            "ended_at": game.ended_at.isoformat() if game.ended_at else None,
        })


class QuizReplayRoundView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, game_id: int, round_n: int) -> Response:  # type: ignore[no-untyped-def]
        try:
            game = QuizGame.objects.get(id=game_id)
        except QuizGame.DoesNotExist:
            return Response({"detail": "Game not found."}, status=status.HTTP_404_NOT_FOUND)

        if round_n < 0 or round_n >= len(game.rounds):
            return Response({"detail": "Round not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(game.rounds[round_n])
