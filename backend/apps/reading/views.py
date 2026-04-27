from rest_framework import permissions, status, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .importer import ReadingImportError, import_reading_csv
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
    """Multipart POST: csv_file"""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):  # type: ignore[no-untyped-def]
        csv_file = request.FILES.get("csv_file")
        if not csv_file:
            return Response({"detail": "csv_file is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = import_reading_csv(csv_file.read())
        except ReadingImportError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"created_passages": result.created_passages, "created_questions": result.created_questions},
            status=status.HTTP_201_CREATED,
        )
