from django.contrib import admin

from .models import ExamOption, ExamQuestion, ExamResult, JLPTExam, UserExamSession, UserQuestionAnswer


class ExamOptionInline(admin.TabularInline):
    model = ExamOption
    extra = 4
    fields = ["label", "text", "image", "is_correct"]


class ExamQuestionInline(admin.TabularInline):
    model = ExamQuestion
    extra = 0
    fields = ["order", "section", "question_type", "question_text"]
    show_change_link = True


@admin.register(JLPTExam)
class JLPTExamAdmin(admin.ModelAdmin):
    list_display = ["id", "level", "title", "section_type", "duration_minutes", "is_published", "created_at"]
    list_filter = ["level", "section_type", "is_published"]
    search_fields = ["title"]
    inlines = [ExamQuestionInline]


@admin.register(ExamQuestion)
class ExamQuestionAdmin(admin.ModelAdmin):
    list_display = ["id", "exam", "order", "section", "question_type", "question_text"]
    list_filter = ["exam__level", "section", "question_type"]
    search_fields = ["question_text"]
    inlines = [ExamOptionInline]


@admin.register(ExamResult)
class ExamResultAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "exam", "score_percentage", "passed", "created_at"]
    list_filter = ["passed", "exam__level"]
    readonly_fields = ["section_scores", "weak_areas", "study_suggestions"]


@admin.register(UserExamSession)
class UserExamSessionAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "exam", "status", "started_at", "submitted_at"]
    list_filter = ["status"]
