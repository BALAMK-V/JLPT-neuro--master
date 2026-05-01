from __future__ import annotations

from rest_framework import permissions, status, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsManagementUser

from .importer import GrammarImportError, import_grammar_csv
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
    """Multipart POST: csv_file

    CSV headers:
      jlpt_level, section, question_type, context_text_jp, prompt,
      option_a, option_b, option_c, option_d, answer, explanation, tags

    tags: optional, semicolon-separated.
    """

    permission_classes = [IsManagementUser]
    parser_classes = [MultiPartParser]

    _MAX_CSV_BYTES = 5 * 1024 * 1024

    def post(self, request):  # type: ignore[no-untyped-def]
        csv_file = request.FILES.get("csv_file")
        if not csv_file:
            return Response({"detail": "csv_file is required."}, status=status.HTTP_400_BAD_REQUEST)
        if csv_file.size > self._MAX_CSV_BYTES:
            return Response({"detail": "File too large (max 5 MB)."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = import_grammar_csv(csv_file.read())
        except GrammarImportError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"created": result.created}, status=status.HTTP_201_CREATED)
