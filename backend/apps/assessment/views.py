from rest_framework import permissions, viewsets

from .models import Test, TestQuestion
from .serializers import TestQuestionSerializer, TestSerializer


class TestViewSet(viewsets.ModelViewSet):
    queryset = Test.objects.all().prefetch_related("questions")
    serializer_class = TestSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["test_type", "jlpt_level", "is_published"]
    search_fields = ["title"]
    ordering_fields = ["id", "created_at", "title"]


class TestQuestionViewSet(viewsets.ModelViewSet):
    queryset = TestQuestion.objects.all()
    serializer_class = TestQuestionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["test", "item_type"]
    ordering_fields = ["id", "order"]
