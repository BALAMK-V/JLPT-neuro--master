from django.contrib import admin

from .models import NeuroOption, NeuroQuestion, UserNeuroAnswer, UserNeuroProfile


class NeuroOptionInline(admin.TabularInline):
    model = NeuroOption
    extra = 0


@admin.register(NeuroQuestion)
class NeuroQuestionAdmin(admin.ModelAdmin):
    list_display = ["order", "question_text", "type", "trait_key", "is_active"]
    list_filter = ["type", "is_active", "trait_key"]
    search_fields = ["question_text"]
    inlines = [NeuroOptionInline]


@admin.register(UserNeuroProfile)
class UserNeuroProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "result_type", "trait_summary", "updated_at"]
    list_filter = ["result_type"]
    search_fields = ["user__username", "user__email"]
    list_select_related = ["user"]
    readonly_fields = ["created_at", "updated_at"]

    def trait_summary(self, obj):  # type: ignore[no-untyped-def]
        scores = obj.trait_scores or {}
        if not scores:
            return "-"
        top = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:3]
        return ", ".join(f"{name}: {score}" for name, score in top)

    trait_summary.short_description = "Top traits"


@admin.register(UserNeuroAnswer)
class UserNeuroAnswerAdmin(admin.ModelAdmin):
    list_display = ["user", "question", "selected_option", "answered_at"]
    search_fields = ["user__username", "question__question_text"]
    list_select_related = ["user", "question", "selected_option"]
