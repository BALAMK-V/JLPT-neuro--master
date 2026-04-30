from __future__ import annotations

from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .analysis import build_result_data
from .models import ExamOption, ExamQuestion, ExamResult, JLPTExam, UserExamSession, UserQuestionAnswer
from .serializers import (
    BulkAnswerSerializer,
    ExamQuestionWithAnswerSerializer,
    ExamResultSerializer,
    JLPTExamDetailSerializer,
    JLPTExamListSerializer,
    UserExamSessionSerializer,
    UserQuestionAnswerSerializer,
)


class JLPTExamViewSet(viewsets.ModelViewSet):
    """CRUD for exams. List uses a compact serializer; detail includes questions."""

    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["level", "section_type", "is_published"]
    search_fields = ["title", "description"]
    ordering_fields = ["id", "created_at", "level"]

    def get_queryset(self):
        return JLPTExam.objects.all().prefetch_related("questions__options")

    def get_serializer_class(self):
        if self.action in ("retrieve", "create", "update", "partial_update"):
            return JLPTExamDetailSerializer
        return JLPTExamListSerializer

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request: Request, pk: int = None) -> Response:
        """Create (or resume) a UserExamSession for the authenticated user."""
        exam = self.get_object()

        existing = UserExamSession.objects.filter(
            user=request.user, exam=exam, status=UserExamSession.Status.IN_PROGRESS
        ).first()
        if existing:
            return Response(UserExamSessionSerializer(existing).data)

        session = UserExamSession.objects.create(
            user=request.user,
            exam=exam,
            time_remaining_seconds=exam.duration_minutes * 60,
        )
        return Response(UserExamSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="my-results")
    def my_results(self, request: Request) -> Response:
        """Return all exam results for the current user."""
        results = ExamResult.objects.filter(user=request.user).select_related("exam").order_by("-created_at")
        serializer = ExamResultSerializer(results, many=True)
        return Response(serializer.data)


class UserExamSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """Read sessions for the current user."""

    serializer_class = UserExamSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserExamSession.objects.filter(user=self.request.user).select_related("exam")

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request: Request, pk: int = None) -> Response:
        """
        Submit all answers for a session and compute the ExamResult.

        Expected body:
          { "answers": [{"question": <id>, "selected_option": <id>, "time_taken_seconds": <n>}, ...],
            "time_remaining_seconds": <n> }
        """
        session: UserExamSession = self.get_object()

        if session.status != UserExamSession.Status.IN_PROGRESS:
            return Response({"detail": "Session already submitted."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = BulkAnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        answers_data: list[dict] = serializer.validated_data["answers"]
        time_remaining: int = serializer.validated_data["time_remaining_seconds"]

        # Persist each answer and mark correctness
        for ans in answers_data:
            question: ExamQuestion = ans["question"]
            selected: ExamOption | None = ans.get("selected_option")
            text_ans: str = ans.get("text_answer", "")

            is_correct = False
            if selected is not None:
                is_correct = selected.is_correct
            elif text_ans:
                correct_opt = question.options.filter(is_correct=True).first()
                if correct_opt:
                    is_correct = correct_opt.text.strip().lower() == text_ans.strip().lower()

            UserQuestionAnswer.objects.update_or_create(
                session=session,
                question=question,
                defaults={
                    "selected_option": selected,
                    "text_answer": text_ans,
                    "is_correct": is_correct,
                    "time_taken_seconds": ans.get("time_taken_seconds", 0),
                },
            )

        # Close session
        session.status = UserExamSession.Status.SUBMITTED
        session.submitted_at = timezone.now()
        session.time_remaining_seconds = time_remaining
        session.save(update_fields=["status", "submitted_at", "time_remaining_seconds"])

        # Build and persist result
        result_data = build_result_data(session)
        result = ExamResult.objects.create(
            user=request.user,
            exam=session.exam,
            session=session,
            **result_data,
        )

        return Response(ExamResultSerializer(result).data, status=status.HTTP_201_CREATED)


class ExamResultViewSet(viewsets.ReadOnlyModelViewSet):
    """Read exam results for the authenticated user."""

    serializer_class = ExamResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ExamResult.objects.filter(user=self.request.user).select_related("exam", "session")

    @action(detail=True, methods=["get"], url_path="review")
    def review(self, request: Request, pk: int = None) -> Response:
        """Return questions with correct answers highlighted for post-exam review."""
        result: ExamResult = self.get_object()
        questions = result.exam.questions.prefetch_related("options", "user_answers")

        session_answers = {
            a.question_id: a for a in result.session.answers.select_related("selected_option")
        }

        output = []
        for q in questions.order_by("order"):
            q_data = ExamQuestionWithAnswerSerializer(q).data
            ans = session_answers.get(q.id)
            q_data["user_selected_option"] = ans.selected_option_id if ans else None
            q_data["user_is_correct"] = ans.is_correct if ans else False
            q_data["time_taken_seconds"] = ans.time_taken_seconds if ans else 0
            output.append(q_data)

        return Response(output)


class UserAnalysisView(APIView):
    """Aggregate analysis across all exam results for the user."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request) -> Response:
        results = ExamResult.objects.filter(user=request.user).order_by("-created_at")
        if not results.exists():
            return Response({"detail": "No exam results found."}, status=status.HTTP_404_NOT_FOUND)

        # Aggregate weak areas across last 10 results
        weak_counter: dict[str, int] = {}
        suggestion_set: list[str] = []

        for r in results[:10]:
            for wa in r.weak_areas:
                weak_counter[wa] = weak_counter.get(wa, 0) + 1
            suggestion_set.extend(r.study_suggestions)

        # Deduplicate suggestions preserving order
        seen: set[str] = set()
        unique_suggestions = []
        for s in suggestion_set:
            if s not in seen:
                seen.add(s)
                unique_suggestions.append(s)

        sorted_weak = sorted(weak_counter.items(), key=lambda x: -x[1])

        # Section score trends from last 5 results
        recent = list(results[:5])
        section_trend: dict[str, list[float]] = {}
        for r in reversed(recent):
            for sec, data in r.section_scores.items():
                section_trend.setdefault(sec, []).append(data["percentage"])

        return Response(
            {
                "total_exams": results.count(),
                "recent_score": results.first().score_percentage if results else 0,
                "persistent_weak_areas": [{"area": wa, "occurrences": cnt} for wa, cnt in sorted_weak],
                "top_suggestions": unique_suggestions[:6],
                "section_trends": {sec: pcts for sec, pcts in section_trend.items()},
            }
        )
