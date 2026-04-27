from django import forms
from django.contrib import admin, messages
from django.http import HttpRequest
from django.shortcuts import redirect, render
from django.urls import path

from .importer import ReadingImportError, import_reading_csv
from .models import ReadingPassage, ReadingQuestion


class ReadingQuestionInline(admin.TabularInline):
    model = ReadingQuestion
    extra = 1


class ReadingImportForm(forms.Form):
    csv_file = forms.FileField(
        help_text=(
            "CSV headers: passage_title, passage_type, jlpt_level, text_jp, text_en, source, tags, "
            "question_type, question, option_a, option_b, option_c, option_d, answer, explanation, order"
        )
    )


@admin.register(ReadingPassage)
class ReadingPassageAdmin(admin.ModelAdmin):
    list_display = ("title", "jlpt_level", "passage_type", "updated_at")
    list_filter = ("jlpt_level", "passage_type")
    search_fields = ("title", "text_jp", "text_en")
    inlines = [ReadingQuestionInline]
    change_list_template = "admin/reading/readingpassage/change_list.html"

    def get_urls(self):  # type: ignore[no-untyped-def]
        urls = super().get_urls()
        custom = [
            path("import-csv/", self.admin_site.admin_view(self.import_csv_view), name="reading_import_csv"),
        ]
        return custom + urls

    def import_csv_view(self, request: HttpRequest):
        if request.method == "POST":
            form = ReadingImportForm(request.POST, request.FILES)
            if form.is_valid():
                try:
                    result = import_reading_csv(form.cleaned_data["csv_file"].read())
                except ReadingImportError as e:
                    messages.error(request, str(e))
                    return redirect("../")

                messages.success(
                    request,
                    f"Imported Reading. created_passages={result.created_passages}, created_questions={result.created_questions}",
                )
                return redirect("../")
        else:
            form = ReadingImportForm()

        help_text = (
            "Supports JLPT-style patterns via passage_type: short, medium, long, integrated, info_search. "
            "Rows with the same passage_title + jlpt_level + passage_type are grouped into one passage."
        )
        return render(request, "admin/import_form.html", {"form": form, "title": "Import Reading CSV", "help_text": help_text})


@admin.register(ReadingQuestion)
class ReadingQuestionAdmin(admin.ModelAdmin):
    list_display = ("passage", "order", "question_type", "answer")
    list_filter = ("question_type", "answer")
    search_fields = ("question", "passage__title")
