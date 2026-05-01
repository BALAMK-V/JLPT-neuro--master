from rest_framework import permissions, status, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.flashcards.models import ImportLog
from apps.import_utils import ImportFileError, parse_import_file
from apps.users.permissions import IsManagementUser

from .importer import ReadingImportError, _import_reading_rows
from .models import ReadingPassage, ReadingQuestion
from .serializers import ReadingPassageSerializer, ReadingQuestionSerializer


class ReadingPassageViewSet(viewsets.ModelViewSet):
    queryset = ReadingPassage.objects.all().prefetch_related("questions")
    serializer_class = ReadingPassageSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["jlpt_level", "passage_type"]
    search_fields = ["title", "text_jp", "text_en"]
    ordering_fields = ["id", "updated_at", "title"]


class ReadingQuestionViewSet(viewsets.ModelViewSet):
    queryset = ReadingQuestion.objects.all().select_related("passage")
    serializer_class = ReadingQuestionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["passage", "question_type"]
    ordering_fields = ["id", "order", "created_at"]


class ReadingImportView(APIView):
    """Multipart POST: import_file (CSV, JSON, or XLSX)

    Required columns: passage_title, passage_type, jlpt_level, text_jp,
                      question, option_a-d, answer
    Optional columns: text_en, source, tags, order, question_type, explanation
    """

    permission_classes = [IsManagementUser]
    parser_classes = [MultiPartParser]

    def post(self, request):  # type: ignore[no-untyped-def]
        import_file = request.FILES.get("import_file") or request.FILES.get("csv_file")
        if not import_file:
            return Response({"detail": "import_file is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rows = parse_import_file(import_file, import_file.name)
            result = _import_reading_rows(rows)
        except (ImportFileError, ReadingImportError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        ImportLog.objects.create(
            user=request.user, content_type=ImportLog.ContentType.READING,
            filename=import_file.name, file_format=import_file.name.rsplit(".", 1)[-1].lower() if "." in import_file.name else "csv",
            rows_imported=result.created_questions,
            extra={"passages": result.created_passages},
        )
        return Response(
            {"created_passages": result.created_passages, "created_questions": result.created_questions},
            status=status.HTTP_201_CREATED,
        )
