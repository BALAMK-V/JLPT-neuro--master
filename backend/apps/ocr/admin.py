from django.contrib import admin

from .models import QuestionPaper


@admin.register(QuestionPaper)
class QuestionPaperAdmin(admin.ModelAdmin):
    list_display = ["id", "original_filename", "level", "file_type", "status", "question_count", "created_at"]
    list_filter = ["status", "level", "file_type"]
    search_fields = ["original_filename"]
    readonly_fields = ["extracted_text", "parsed_questions", "processed_at", "error_message"]

    @admin.display(description="Questions parsed")
    def question_count(self, obj: QuestionPaper) -> int:
        return obj.question_count
