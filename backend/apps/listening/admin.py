from django import forms
from django.contrib import admin, messages
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.http import HttpRequest
from django.shortcuts import redirect, render
from django.urls import path

from apps.content.models import JLPTLevel

from .models import ListeningQuestion


class ListeningImportForm(forms.Form):
    csv_file = forms.FileField(
        help_text=(
            "CSV headers: audio_file, section, question_type, audio_text, question, option_a, option_b, option_c, option_d, "
            "answer, explanation, jlpt_level"
        )
    )
    audio_zip = forms.FileField(required=False, help_text="Optional ZIP with audio files referenced by audio_file")


class AudioZipOnlyForm(forms.Form):
    audio_zip = forms.FileField(help_text="ZIP of audio files. Saved under listening/audio/")


@admin.register(ListeningQuestion)
class ListeningQuestionAdmin(admin.ModelAdmin):
    list_display = ("id", "jlpt_level", "section", "question_type", "audio_filename", "answer", "created_at")
    list_filter = ("jlpt_level", "section", "question_type", "answer")
    search_fields = ("question", "audio_filename", "audio_text")
    change_list_template = "admin/listening/listeningquestion/change_list.html"

    def get_urls(self):  # type: ignore[no-untyped-def]
        urls = super().get_urls()
        custom = [
            path("import-csv/", self.admin_site.admin_view(self.import_csv_view), name="listening_import_csv"),
            path(
                "import-audio-zip/",
                self.admin_site.admin_view(self.import_audio_zip_view),
                name="listening_import_audio_zip",
            ),
        ]
        return custom + urls

    def import_csv_view(self, request: HttpRequest):
        import csv
        import io
        import os
        import zipfile

        if request.method == "POST":
            form = ListeningImportForm(request.POST, request.FILES)
            if form.is_valid():
                decoded = form.cleaned_data["csv_file"].read().decode("utf-8-sig")
                reader = csv.DictReader(io.StringIO(decoded))
                if not reader.fieldnames:
                    messages.error(request, "CSV has no headers.")
                    return redirect("../")

                normalized = {h.strip().lower(): h for h in reader.fieldnames if h}
                required = ["audio_file", "question", "option_a", "option_b", "option_c", "option_d", "answer"]
                for r in required:
                    if r not in normalized:
                        messages.error(request, f"Missing required header: {r}")
                        return redirect("../")

                audio_zip = form.cleaned_data.get("audio_zip")
                zip_reader = None
                zip_names = set()
                zip_by_basename: dict[str, str] = {}
                if audio_zip:
                    zip_reader = zipfile.ZipFile(io.BytesIO(audio_zip.read()))
                    zip_names = set(zip_reader.namelist())
                    zip_by_basename = {os.path.basename(n): n for n in zip_names if n and not n.endswith("/")}

                valid_sections = {c for c, _ in ListeningQuestion.Section.choices}
                valid_types = {c for c, _ in ListeningQuestion.QuestionType.choices}

                def get(raw, name: str) -> str:
                    return (raw.get(normalized.get(name, name)) or "").strip()

                def norm_section(raw: str) -> str:
                    v = (raw or "").strip().lower()
                    if not v:
                        return ListeningQuestion.Section.OTHER
                    mapping = {
                        "課題理解": "kadai",
                        "かだい": "kadai",
                        "kadai": "kadai",
                        "ポイント理解": "point",
                        "point": "point",
                        "概要理解": "gaiyo",
                        "gaiyo": "gaiyo",
                        "即時応答": "sokuji",
                        "sokuji": "sokuji",
                        "統合理解": "togo",
                        "togo": "togo",
                    }
                    return mapping.get(raw.strip(), mapping.get(v, v))

                def norm_type(raw: str) -> str:
                    v = (raw or "").strip().lower()
                    if not v:
                        return ListeningQuestion.QuestionType.OTHER
                    mapping = {
                        "gist": "gist",
                        "main": "gist",
                        "main_idea": "gist",
                        "detail": "detail",
                        "details": "detail",
                        "inference": "inference",
                        "infer": "inference",
                        "purpose": "purpose",
                        "intent": "purpose",
                        "response": "response",
                        "reply": "response",
                    }
                    return mapping.get(raw.strip(), mapping.get(v, v))

                created = 0
                for idx, raw in enumerate(reader, start=2):
                    audio_name = get(raw, "audio_file")
                    if audio_name and (audio_name.startswith("/") or ".." in audio_name or "\\" in audio_name):
                        messages.error(request, f"Unsafe audio_file at CSV line {idx}.")
                        return redirect("../")

                    ans = get(raw, "answer").upper()
                    if ans not in {"A", "B", "C", "D"}:
                        messages.error(request, f"Invalid answer at CSV line {idx} (must be A-D).")
                        return redirect("../")

                    level = get(raw, "jlpt_level") or JLPTLevel.N2
                    if level not in {c for c, _ in JLPTLevel.choices}:
                        messages.error(request, f"Invalid jlpt_level at CSV line {idx}.")
                        return redirect("../")

                    section = norm_section(get(raw, "section"))
                    if section not in valid_sections:
                        messages.error(request, f"Invalid section at CSV line {idx}.")
                        return redirect("../")

                    qtype = norm_type(get(raw, "question_type"))
                    if qtype not in valid_types:
                        messages.error(request, f"Invalid question_type at CSV line {idx}.")
                        return redirect("../")

                    if zip_reader and audio_name:
                        if audio_name not in zip_names and audio_name not in zip_by_basename:
                            messages.error(request, f"Audio '{audio_name}' not found in ZIP (line {idx}).")
                            return redirect("../")

                    obj = ListeningQuestion.objects.create(
                        audio_filename=audio_name,
                        section=section,
                        question_type=qtype,
                        audio_text=get(raw, "audio_text"),
                        question=get(raw, "question"),
                        option_a=get(raw, "option_a"),
                        option_b=get(raw, "option_b"),
                        option_c=get(raw, "option_c"),
                        option_d=get(raw, "option_d"),
                        answer=ans,
                        explanation=get(raw, "explanation"),
                        jlpt_level=level,
                    )

                    if zip_reader and audio_name:
                        entry_name = audio_name if audio_name in zip_names else zip_by_basename.get(audio_name)
                        data = zip_reader.read(entry_name)
                        basename = os.path.basename(entry_name)
                        saved_name = default_storage.save(f"listening/audio/{basename}", ContentFile(data))
                        obj.audio_file.name = saved_name
                        obj.save(update_fields=["audio_file"])
                    elif audio_name:
                        existing = f"listening/audio/{audio_name}"
                        if default_storage.exists(existing):
                            obj.audio_file.name = existing
                            obj.save(update_fields=["audio_file"])

                    created += 1

                messages.success(request, f"Imported Listening questions. created={created}")
                return redirect("../")
        else:
            form = ListeningImportForm()

        help_text = (
            "section values: kadai, point, gaiyo, sokuji, togo. "
            "question_type values: gist, detail, inference, purpose, response. "
            "Upload an audio ZIP if you want filename validation (audio_file must match)."
        )
        return render(
            request,
            "admin/import_form.html",
            {"form": form, "title": "Import Listening CSV (+ optional ZIP)", "help_text": help_text},
        )

    def import_audio_zip_view(self, request: HttpRequest):
        import io
        import os
        import zipfile

        if request.method == "POST":
            form = AudioZipOnlyForm(request.POST, request.FILES)
            if form.is_valid():
                zip_reader = zipfile.ZipFile(io.BytesIO(form.cleaned_data["audio_zip"].read()))
                saved = []
                for name in zip_reader.namelist():
                    if name.endswith("/"):
                        continue
                    if name.startswith("/") or ".." in name or "\\" in name:
                        messages.error(request, f"Unsafe filename in ZIP: {name}")
                        return redirect("../")
                    data = zip_reader.read(name)
                    basename = os.path.basename(name)
                    saved_name = default_storage.save(f"listening/audio/{basename}", ContentFile(data))
                    saved.append(saved_name.split("/")[-1])

                saved = sorted(set(saved))
                if saved:
                    messages.success(request, f"Uploaded {len(saved)} audio files. Example: {saved[0]}")
                else:
                    messages.warning(request, "No files found in ZIP.")
                return redirect("../")
        else:
            form = AudioZipOnlyForm()

        help_text = "This uploads audio files only. Use the filenames in your Listening CSV (audio_file column)."
        return render(request, "admin/import_form.html", {"form": form, "title": "Import Audio ZIP", "help_text": help_text})
