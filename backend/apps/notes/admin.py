from django.contrib import admin

from .models import Note


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ("user", "note_type", "reference_type", "reference_id", "content_preview", "updated_at")
    list_filter = ("note_type", "reference_type", "updated_at")
    search_fields = ("content", "user__username", "user__email")
    list_select_related = ("user",)
    list_editable = ("note_type", "reference_type", "reference_id")

    def content_preview(self, obj):  # type: ignore[no-untyped-def]
        return (obj.content or "")[:90]

    content_preview.short_description = "Content"
