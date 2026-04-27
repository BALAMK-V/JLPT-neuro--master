from django import forms
from django.contrib import admin, messages
from django.http import HttpRequest
from django.shortcuts import redirect, render
from django.urls import path

from .importer import GrammarImportError, import_grammar_csv
from .models import GrammarQuestion


class GrammarImportForm(forms.Form):
    csv_file = forms.FileField(
        help_text=(
            "CSV headers: jlpt_level, section, question_type, context_text_jp, prompt, option_a..option_d, answer, explanation, tags"
        )
    )


@admin.register(GrammarQuestion)
class GrammarQuestionAdmin(admin.ModelAdmin):
    list_display = ("id", "jlpt_level", "section", "question_type", "created_at")
    list_filter = ("jlpt_level", "section", "question_type")
    search_fields = ("prompt", "context_text_jp", "explanation")
    change_list_template = "admin/grammar/grammarquestion/change_list.html"

    def get_urls(self):  # type: ignore[no-untyped-def]
        urls = super().get_urls()
        custom = [
            path("import-csv/", self.admin_site.admin_view(self.import_csv_view), name="grammar_import_csv"),
        ]
        return custom + urls

    def import_csv_view(self, request: HttpRequest):
        if request.method == "POST":
            form = GrammarImportForm(request.POST, request.FILES)
            if form.is_valid():
                try:
                    result = import_grammar_csv(form.cleaned_data["csv_file"].read())
                except GrammarImportError as e:
                    messages.error(request, str(e))
                    return redirect("../")

                messages.success(request, f"Imported Grammar. created={result.created}")
                return redirect("../")
        else:
            form = GrammarImportForm()

        help_text = (
            "section values: bunpo_form, sentence_build, text_grammar. "
            "question_type values: choose, fill_blank, reorder, error_find. "
            "tags: optional 'tag1;tag2'."
        )
        return render(request, "admin/import_form.html", {"form": form, "title": "Import Grammar CSV", "help_text": help_text})
