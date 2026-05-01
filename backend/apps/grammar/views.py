from __future__ import annotations

from rest_framework import permissions, status, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.flashcards.models import ImportLog
from apps.import_utils import ImportFileError, parse_import_file
from apps.users.permissions import IsManagementUser

from .importer import GrammarImportError, _import_grammar_rows
from .models import GrammarQuestion
from .serializers import GrammarQuestionSerializer


class GrammarQuestionViewSet(viewsets.ModelViewSet):
    queryset = GrammarQuestion.objects.all()
    serializer_class = GrammarQuestionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["jlpt_level", "section", "question_type"]
    search_fields = ["prompt", "context_text_jp", "explanation"]
    ordering_fields = ["id", "created_at", "jlpt_level", "section"]


class GrammarImportView(APIView):
    """Multipart POST: import_file (CSV, JSON, or XLSX)

    Required columns: prompt, option_a, option_b, option_c, option_d, answer
    Optional columns: jlpt_level, section, question_type, context_text_jp, explanation, tags
    tags: semicolon-separated.
    """

    permission_classes = [IsManagementUser]
    parser_classes = [MultiPartParser]

    def post(self, request):  # type: ignore[no-untyped-def]
        import_file = request.FILES.get("import_file") or request.FILES.get("csv_file")
        if not import_file:
            return Response({"detail": "import_file is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rows = parse_import_file(import_file, import_file.name)
            result = _import_grammar_rows(rows)
        except (ImportFileError, GrammarImportError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        ImportLog.objects.create(
            user=request.user, content_type=ImportLog.ContentType.GRAMMAR,
            filename=import_file.name, file_format=import_file.name.rsplit(".", 1)[-1].lower() if "." in import_file.name else "csv",
            rows_imported=result.created,
        )
        return Response({"created": result.created}, status=status.HTTP_201_CREATED)
