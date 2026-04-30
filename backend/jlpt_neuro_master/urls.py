from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView
from rest_framework.routers import DefaultRouter

from apps.assessment.views import TestQuestionViewSet, TestViewSet
from apps.content.views import KanjiImportView, KanjiViewSet, VocabularyImportView, VocabularyViewSet
from apps.flashcards.views import CardViewSet, DeckViewSet, FlashImportView, FlashNextView, FlashReviewView
from apps.grammar.views import GrammarImportView, GrammarQuestionViewSet
from apps.listening.views import AudioZipImportView, ListeningImportView, ListeningQuestionViewSet
from apps.reading.views import ReadingImportView, ReadingPassageViewSet, ReadingQuestionViewSet
from apps.notes.views import NoteViewSet
from apps.neuro.views import NeuroQuestionListView, NeuroResultView, NeuroSubmitView
from apps.tracking.views import DashboardView, SessionViewSet, UserProgressViewSet
from apps.users.views import AppearanceResetView, AppearanceUpdateView, AppearanceView, CompanionUpdateView, CompanionView, MeView
from apps.jlpt_exam.views import ExamResultViewSet, JLPTExamViewSet, UserAnalysisView, UserExamSessionViewSet
from apps.ocr.views import (
    AIParsePaperView,
    ImportParsedQuestionsView,
    QuestionPaperDetailView,
    QuestionPaperListView,
    QuestionPaperUploadView,
    UpdateParsedQuestionsView,
)

admin.site.site_header = "JLPT Neuro Master"
admin.site.site_title = "JLPT Neuro Admin"
admin.site.index_title = "Manage learning system"


router = DefaultRouter()
router.register(r"kanji", KanjiViewSet, basename="kanji")
router.register(r"vocab", VocabularyViewSet, basename="vocab")
router.register(r"flash/decks", DeckViewSet, basename="flash-deck")
router.register(r"flash/cards", CardViewSet, basename="flash-card")
router.register(r"listening/questions", ListeningQuestionViewSet, basename="listening-question")
router.register(r"reading/passages", ReadingPassageViewSet, basename="reading-passage")
router.register(r"reading/questions", ReadingQuestionViewSet, basename="reading-question")
router.register(r"grammar/questions", GrammarQuestionViewSet, basename="grammar-question")
router.register(r"tests", TestViewSet, basename="test")
router.register(r"tests/questions", TestQuestionViewSet, basename="test-question")
router.register(r"notes", NoteViewSet, basename="note")
router.register(r"progress", UserProgressViewSet, basename="progress")
router.register(r"sessions", SessionViewSet, basename="session")
router.register(r"exams", JLPTExamViewSet, basename="jlpt-exam")
router.register(r"exam-sessions", UserExamSessionViewSet, basename="exam-session")
router.register(r"exam-results", ExamResultViewSet, basename="exam-result")

urlpatterns = [
    path("", RedirectView.as_view(url="/api/", permanent=False), name="root"),
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/kanji/import/", KanjiImportView.as_view(), name="kanji-import"),
    path("api/vocab/import/", VocabularyImportView.as_view(), name="vocab-import"),
    path("api/reading/import/", ReadingImportView.as_view(), name="reading-import"),
    path("api/grammar/import/", GrammarImportView.as_view(), name="grammar-import"),
    path("api/flash/next/", FlashNextView.as_view(), name="flash-next"),
    path("api/flash/review/", FlashReviewView.as_view(), name="flash-review"),
    path("api/flash/import/", FlashImportView.as_view(), name="flash-import"),
    path("api/listening/audio/import/", AudioZipImportView.as_view(), name="listening-audio-import"),
    path("api/listening/import/", ListeningImportView.as_view(), name="listening-import"),
    path("api/dashboard/", DashboardView.as_view(), name="dashboard"),
    path("api/neuro/questions/", NeuroQuestionListView.as_view(), name="neuro-questions"),
    path("api/neuro/submit/", NeuroSubmitView.as_view(), name="neuro-submit"),
    path("api/neuro/result/", NeuroResultView.as_view(), name="neuro-result"),
    path("api/appearance/", AppearanceView.as_view(), name="appearance"),
    path("api/appearance/update/", AppearanceUpdateView.as_view(), name="appearance-update"),
    path("api/appearance/reset/", AppearanceResetView.as_view(), name="appearance-reset"),
    path("api/companion/", CompanionView.as_view(), name="companion"),
    path("api/companion/update/", CompanionUpdateView.as_view(), name="companion-update"),
    path("api/auth/", include("apps.users.auth_urls")),
    path("api/auth/me/", MeView.as_view(), name="me"),
    # JLPT Exam system
    path("api/exams/<int:pk>/start/", JLPTExamViewSet.as_view({"post": "start"}), name="exam-start"),
    path("api/exam-sessions/<int:pk>/submit/", UserExamSessionViewSet.as_view({"post": "submit"}), name="exam-submit"),
    path("api/exam-results/<int:pk>/review/", ExamResultViewSet.as_view({"get": "review"}), name="exam-review"),
    path("api/analysis/", UserAnalysisView.as_view(), name="user-analysis"),
    # OCR / question paper upload
    path("api/ocr/upload/", QuestionPaperUploadView.as_view(), name="ocr-upload"),
    path("api/ocr/papers/", QuestionPaperListView.as_view(), name="ocr-papers"),
    path("api/ocr/papers/<int:pk>/", QuestionPaperDetailView.as_view(), name="ocr-paper-detail"),
    path("api/ocr/papers/<int:pk>/ai-parse/", AIParsePaperView.as_view(), name="ocr-ai-parse"),
    path("api/ocr/papers/<int:pk>/questions/", UpdateParsedQuestionsView.as_view(), name="ocr-update-questions"),
    path("api/ocr/import/", ImportParsedQuestionsView.as_view(), name="ocr-import"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

