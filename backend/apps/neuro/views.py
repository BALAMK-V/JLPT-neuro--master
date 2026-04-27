from __future__ import annotations

from collections import defaultdict

from django.db import transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import UserProfile

from .models import NeuroOption, NeuroQuestion, UserNeuroAnswer, UserNeuroProfile
from .scoring import build_summary, classify, normalize_scores, profile_adjustments
from .serializers import NeuroQuestionSerializer, NeuroSubmitSerializer, UserNeuroProfileSerializer


class NeuroQuestionListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):  # type: ignore[no-untyped-def]
        questions = NeuroQuestion.objects.filter(is_active=True).prefetch_related("options")
        return Response(NeuroQuestionSerializer(questions, many=True).data)


class NeuroSubmitView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):  # type: ignore[no-untyped-def]
        serializer = NeuroSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        answers = serializer.validated_data["answers"]
        active_question_ids = set(NeuroQuestion.objects.filter(is_active=True).values_list("id", flat=True))
        submitted_question_ids = {answer["question_id"] for answer in answers}
        if submitted_question_ids != active_question_ids or len(submitted_question_ids) != len(answers):
            return Response({"detail": "Please answer every active neuro analysis question."}, status=status.HTTP_400_BAD_REQUEST)

        option_ids = [answer["option_id"] for answer in answers]
        options = NeuroOption.objects.select_related("question").in_bulk(option_ids)

        raw_scores: dict[str, float] = defaultdict(float)
        trait_max_scores: dict[str, float] = defaultdict(float)
        answer_rows = []

        for answer in answers:
            option = options.get(answer["option_id"])
            if not option or option.question_id != answer["question_id"] or not option.question.is_active:
                return Response({"detail": "Invalid question/option selection."}, status=status.HTTP_400_BAD_REQUEST)

            for trait, weight in option.weight_mapping.items():
                raw_scores[trait] += float(weight)
            question_options = option.question.options.all()
            traits_for_question = {trait for opt in question_options for trait in opt.weight_mapping.keys()}
            for trait in traits_for_question:
                trait_max_scores[trait] += max(float(opt.weight_mapping.get(trait, 0)) for opt in question_options)
            answer_rows.append(
                UserNeuroAnswer(
                    user=request.user,
                    question=option.question,
                    selected_option=option,
                    score=option.weight_mapping,
                )
            )

        trait_scores = normalize_scores(dict(raw_scores), dict(trait_max_scores))
        result_type = classify(trait_scores)
        summary = build_summary(result_type, trait_scores)

        UserNeuroAnswer.objects.filter(user=request.user).delete()
        UserNeuroAnswer.objects.bulk_create(answer_rows)
        profile, _ = UserNeuroProfile.objects.update_or_create(
            user=request.user,
            defaults={"result_type": result_type, "trait_scores": trait_scores, "summary": summary},
        )

        adjustments = profile_adjustments(result_type)
        user_profile, _ = UserProfile.objects.get_or_create(user=request.user)
        ui_prefs = {**(user_profile.ui_prefs or {}), **adjustments.pop("ui_prefs")}
        for key, value in adjustments.items():
            setattr(user_profile, key, value)
        user_profile.ui_prefs = ui_prefs
        user_profile.save()

        return Response(UserNeuroProfileSerializer(profile).data, status=status.HTTP_201_CREATED)


class NeuroResultView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):  # type: ignore[no-untyped-def]
        try:
            profile = request.user.neuro_profile
        except UserNeuroProfile.DoesNotExist:
            return Response({"detail": "No neuro analysis result found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(UserNeuroProfileSerializer(profile).data)
