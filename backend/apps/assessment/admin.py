from django.contrib import admin

from .models import Test, TestQuestion


class TestQuestionInline(admin.TabularInline):
    model = TestQuestion
    extra = 1
    fields = ("order", "item_type", "item_id", "prompt", "choices", "correct_answer", "explanation")


@admin.action(description="Publish selected tests")
def publish_tests(modeladmin, request, queryset):  # type: ignore[no-untyped-def]
    queryset.update(is_published=True)


@admin.action(description="Unpublish selected tests")
def unpublish_tests(modeladmin, request, queryset):  # type: ignore[no-untyped-def]
    queryset.update(is_published=False)


@admin.register(Test)
class TestAdmin(admin.ModelAdmin):
    list_display = ("title", "test_type", "jlpt_level", "timed", "duration_seconds", "question_count", "is_published", "created_at")
    list_filter = ("test_type", "jlpt_level", "timed", "is_published")
    search_fields = ("title",)
    list_editable = ("test_type", "jlpt_level", "timed", "duration_seconds", "is_published")
    inlines = [TestQuestionInline]
    actions = [publish_tests, unpublish_tests]
    fieldsets = (
        ("Test", {"fields": ("title", "test_type", "jlpt_level", "is_published")}),
        ("Timing", {"fields": ("timed", "duration_seconds")}),
        ("Ownership", {"fields": ("created_by",)}),
    )
    readonly_fields = ("created_by",)

    def question_count(self, obj):  # type: ignore[no-untyped-def]
        return obj.questions.count()

    question_count.short_description = "Questions"


@admin.register(TestQuestion)
class TestQuestionAdmin(admin.ModelAdmin):
    list_display = ("test", "order", "item_type", "item_id", "prompt_preview")
    list_filter = ("item_type",)
    search_fields = ("test__title", "prompt")
    list_select_related = ("test",)
    list_editable = ("order", "item_type")

    def prompt_preview(self, obj):  # type: ignore[no-untyped-def]
        return (obj.prompt or "")[:80]

    prompt_preview.short_description = "Prompt"
