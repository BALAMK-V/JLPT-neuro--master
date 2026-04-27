from django.contrib import admin
from django.utils import timezone

from .models import Session, UserProgress


@admin.action(description="Move selected progress items to review today")
def make_progress_due_today(modeladmin, request, queryset):  # type: ignore[no-untyped-def]
    queryset.update(next_review_date=timezone.localdate())


@admin.action(description="Clear selected progress accuracy")
def clear_progress_stats(modeladmin, request, queryset):  # type: ignore[no-untyped-def]
    queryset.update(
        accuracy=0,
        attempts=0,
        correct_attempts=0,
        repetitions=0,
        interval_days=1,
        ease_factor=2.5,
        last_reviewed=None,
        last_result_correct=False,
        next_review_date=timezone.localdate(),
    )


@admin.register(UserProgress)
class UserProgressAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "item_type",
        "item_id",
        "accuracy",
        "attempts",
        "correct_attempts",
        "repetitions",
        "next_review_date",
        "updated_at",
    )
    list_filter = ("item_type", "next_review_date", "last_result_correct")
    search_fields = ("user__username", "user__email", "item_type", "item_id")
    list_editable = ("next_review_date",)
    list_select_related = ("user",)
    actions = [make_progress_due_today, clear_progress_stats]
    fieldsets = (
        ("Owner and item", {"fields": ("user", "item_type", "item_id")}),
        ("Performance", {"fields": ("accuracy", "attempts", "correct_attempts", "last_result_correct")}),
        ("Scheduling", {"fields": ("repetitions", "interval_days", "ease_factor", "last_reviewed", "next_review_date")}),
    )


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ("user", "goal_type", "goal_target", "progress_count", "progress_percent", "started_at", "ended_at")
    list_filter = ("goal_type", "started_at", "ended_at")
    search_fields = ("user__username", "user__email", "reflection")
    list_select_related = ("user",)
    list_editable = ("goal_target", "progress_count")
    fieldsets = (
        ("Owner and goal", {"fields": ("user", "goal_type", "goal_target", "progress_count")}),
        ("Timing", {"fields": ("started_at", "ended_at", "duration_seconds")}),
        ("Reflection", {"fields": ("reflection", "summary")}),
    )
    readonly_fields = ("started_at",)

    def progress_percent(self, obj):  # type: ignore[no-untyped-def]
        if not obj.goal_target:
            return "0%"
        return f"{min(100, round((obj.progress_count / obj.goal_target) * 100))}%"

    progress_percent.short_description = "Progress"
