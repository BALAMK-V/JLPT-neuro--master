from django.urls import path

from .views import QuizHistoryView, QuizReplayView, QuizReplayRoundView

urlpatterns = [
    path("history/", QuizHistoryView.as_view(), name="quiz-history"),
    path("replay/<int:game_id>/", QuizReplayView.as_view(), name="quiz-replay"),
    path("replay/<int:game_id>/round/<int:round_n>/", QuizReplayRoundView.as_view(), name="quiz-replay-round"),
]
