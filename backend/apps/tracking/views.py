from __future__ import annotations

from datetime import date

from django.db.models import Avg, Count
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.content.models import Vocabulary
from apps.flashcards.models import Card

from .models import Session, UserProgress
from .serializers import ReviewApplySerializer, SessionSerializer, UserProgressSerializer


class UserProgressViewSet(viewsets.ModelViewSet):
    serializer_class = UserProgressSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["item_type", "next_review_date"]
    ordering_fields = ["next_review_date", "updated_at", "accuracy"]

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return UserProgress.objects.filter(user=self.request.user)

    def perform_create(self, serializer):  # type: ignore[no-untyped-def]
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"], url_path="apply-review")
    def apply_review(self, request, pk=None):  # type: ignore[no-untyped-def]
        obj = self.get_object()
        s = ReviewApplySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        obj.apply_review(correct=s.validated_data["correct"])
        obj.save()
        return Response(UserProgressSerializer(obj).data)


class SessionViewSet(viewsets.ModelViewSet):
    serializer_class = SessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    ordering_fields = ["started_at", "ended_at"]

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return Session.objects.filter(user=self.request.user)


class DashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):  # type: ignore[no-untyped-def]
        user = request.user
        today = date.today()
        progress = UserProgress.objects.filter(user=user)
        due_count = progress.filter(next_review_date__lte=today).count()
        avg_accuracy = progress.aggregate(avg=Avg("accuracy"))["avg"] or 0.0

        weak = progress.values("item_type").annotate(avg=Avg("accuracy"), count=Count("id")).order_by("avg")[:5]

        flash_due_count = Card.objects.filter(
            deck__user=user, suspended=False, due_at__lte=timezone.now()
        ).count()

        # Top 5 most-frequent vocab words the user hasn't learned yet
        learned_vocab_ids = set(
            progress.filter(item_type="vocab").values_list("item_id", flat=True)
        )
        level = getattr(getattr(user, "profile", None), "jlpt_level", None)
        freq_qs = Vocabulary.objects.filter(
            frequency_rank__isnull=False
        ).exclude(id__in=learned_vocab_ids).order_by("frequency_rank")
        if level:
            freq_qs = freq_qs.filter(jlpt_level=level)
        top_unknown = list(
            freq_qs[:5].values("id", "word", "reading", "meaning_en", "frequency_rank")
        )

        return Response(
            {
                "avg_accuracy": round(avg_accuracy, 2),
                "due_reviews": due_count,
                "flash_due_count": flash_due_count,
                "weak_areas": list(weak),
                "streak_days": 0,
                "minutes_spent_today": 0,
                "top_unknown_words": top_unknown,
                "recommendations": self._recommendations(user, progress),
            },
            status=status.HTTP_200_OK,
        )

    def _learning_alias(self, user):  # type: ignore[no-untyped-def]
        profile = getattr(user, "profile", None)
        ui_prefs = getattr(profile, "ui_prefs", {}) or {}
        return ui_prefs.get("learning_alias") or getattr(profile, "learning_type", "balanced")

    def _style_copy(self, alias: str):  # type: ignore[no-untyped-def]
        if alias == "quick_reset":
            return {"minutes": 8, "count": 8, "tone": "short reset"}
        if alias == "focus_support":
            return {"minutes": 10, "count": 12, "tone": "guided focus"}
        if alias == "calm_structure":
            return {"minutes": 12, "count": 10, "tone": "calm structured"}
        return {"minutes": 25, "count": 20, "tone": "mixed practice"}

    def _recommendations(self, user, progress_qs):  # type: ignore[no-untyped-def]
        today = date.today()
        due = progress_qs.filter(next_review_date__lte=today).count()
        weakest = progress_qs.values("item_type").annotate(avg=Avg("accuracy"), count=Count("id")).order_by("avg").first()
        alias = self._learning_alias(user)
        style = self._style_copy(alias)
        rec = []
        if due:
            target = min(due, style["count"])
            rec.append(
                {
                    "type": "reviews",
                    "reason": "due_reviews",
                    "count": due,
                    "learning_alias": alias,
                    "title": f"{target} due reviews",
                    "detail": f"Clear a {style['tone']} review batch before adding new items.",
                    "action": f"{style['minutes']} min",
                }
            )
        if weakest and (weakest.get("count") or 0) >= 5:
            rec.append(
                {
                    "type": "practice",
                    "reason": "weak_area",
                    "item_type": weakest["item_type"],
                    "learning_alias": alias,
                    "title": f"Practice {weakest['item_type']}",
                    "detail": f"This is currently your lowest accuracy area. Keep it to {style['count']} items.",
                    "action": "weak area",
                }
            )
        if not rec:
            rec.append(
                {
                    "type": "session",
                    "reason": "style_default",
                    "learning_alias": alias,
                    "title": f"Start {style['tone']}",
                    "detail": f"Use a {style['minutes']}-minute block with about {style['count']} items.",
                    "action": f"{style['count']} items",
                }
            )
        return rec
