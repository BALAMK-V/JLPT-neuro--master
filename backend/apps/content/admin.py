import csv
import io

from django import forms
from django.contrib import admin, messages
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.urls import path

from .models import JLPTLevel, Kanji, KanjiExample, Vocabulary


def _csv_response(filename: str) -> HttpResponse:
    res = HttpResponse(content_type="text/csv; charset=utf-8")
    res["Content-Disposition"] = f'attachment; filename="{filename}"'
    return res


def _write_kanji(writer, qs):  # type: ignore[no-untyped-def]
    writer.writerow(["character", "onyomi", "kunyomi", "meaning_en", "jlpt_level", "examples"])
    for k in qs.prefetch_related("examples"):
        examples = []
        for ex in k.examples.all():
            jp = (ex.sentence_jp or "").replace("\n", " ").strip()
            en = (ex.sentence_en or "").replace("\n", " ").strip()
            examples.append(f"{jp}|{en}" if en else jp)
        writer.writerow([k.character, k.onyomi, k.kunyomi, k.meaning_en, k.jlpt_level, "; ".join(examples)])


def _write_vocab(writer, qs):  # type: ignore[no-untyped-def]
    writer.writerow(["word", "reading", "meaning_en", "jlpt_level", "related_kanji"])
    for v in qs.prefetch_related("related_kanji"):
        rel = ";".join(sorted({k.character for k in v.related_kanji.all()}))
        writer.writerow([v.word, v.reading, v.meaning_en, v.jlpt_level, rel])


@admin.action(description="Export selected Kanji to CSV")
def export_kanji_csv(modeladmin, request, queryset):  # type: ignore[no-untyped-def]
    from django.utils import timezone

    ts = timezone.now().strftime("%Y%m%d_%H%M%S")
    res = _csv_response(f"kanji_export_{ts}.csv")
    _write_kanji(csv.writer(res), queryset)
    return res


@admin.action(description="Export selected Vocabulary to CSV")
def export_vocab_csv(modeladmin, request, queryset):  # type: ignore[no-untyped-def]
    from django.utils import timezone

    ts = timezone.now().strftime("%Y%m%d_%H%M%S")
    res = _csv_response(f"vocab_export_{ts}.csv")
    _write_vocab(csv.writer(res), queryset)
    return res


class KanjiCsvImportForm(forms.Form):
    csv_file = forms.FileField(help_text="CSV with headers: character, onyomi, kunyomi, meaning_en, jlpt_level, examples")


class VocabCsvImportForm(forms.Form):
    csv_file = forms.FileField(help_text="CSV with headers: word, reading, meaning_en, jlpt_level, related_kanji")


def _decode_csv(uploaded) -> csv.DictReader:  # type: ignore[no-untyped-def]
    decoded = uploaded.read().decode("utf-8-sig")
    return csv.DictReader(io.StringIO(decoded))


class KanjiExampleInline(admin.TabularInline):
    model = KanjiExample
    extra = 1


@admin.register(Kanji)
class KanjiAdmin(admin.ModelAdmin):
    list_display = ("character", "jlpt_level", "meaning_en")
    list_filter = ("jlpt_level",)
    search_fields = ("character", "meaning_en", "onyomi", "kunyomi")
    inlines = [KanjiExampleInline]
    actions = [export_kanji_csv]
    change_list_template = "admin/content/kanji/change_list.html"

    def get_urls(self):  # type: ignore[no-untyped-def]
        urls = super().get_urls()
        custom = [
            path("export-all/", self.admin_site.admin_view(self.export_all_view), name="content_kanji_export_all"),
            path("import-csv/", self.admin_site.admin_view(self.import_csv_view), name="content_kanji_import_csv"),
        ]
        return custom + urls

    def export_all_view(self, request: HttpRequest):
        from django.utils import timezone

        ts = timezone.now().strftime("%Y%m%d_%H%M%S")
        res = _csv_response(f"kanji_export_all_{ts}.csv")
        _write_kanji(csv.writer(res), Kanji.objects.all())
        return res

    def import_csv_view(self, request: HttpRequest):
        if request.method == "POST":
            form = KanjiCsvImportForm(request.POST, request.FILES)
            if form.is_valid():
                reader = _decode_csv(form.cleaned_data["csv_file"])
                if not reader.fieldnames:
                    messages.error(request, "CSV has no headers.")
                    return redirect("../")
                normalized = {h.strip().lower(): h for h in reader.fieldnames if h}
                for req in ["character", "meaning_en"]:
                    if req not in normalized:
                        messages.error(request, f"Missing required header: {req}")
                        return redirect("../")

                created = 0
                updated = 0
                for idx, raw in enumerate(reader, start=2):
                    def get(name: str) -> str:
                        return (raw.get(normalized.get(name, name)) or "").strip()

                    ch = get("character")
                    if not ch or len(ch) != 1:
                        messages.error(request, f"Invalid character at line {idx}.")
                        return redirect("../")

                    level = get("jlpt_level") or JLPTLevel.N2
                    if level not in {c for c, _ in JLPTLevel.choices}:
                        messages.error(request, f"Invalid jlpt_level at line {idx}.")
                        return redirect("../")

                    defaults = {
                        "onyomi": get("onyomi"),
                        "kunyomi": get("kunyomi"),
                        "meaning_en": get("meaning_en"),
                        "jlpt_level": level,
                    }
                    obj, was_created = Kanji.objects.update_or_create(character=ch, defaults=defaults)
                    created += 1 if was_created else 0
                    updated += 0 if was_created else 1

                    examples_str = get("examples")
                    if examples_str:
                        obj.examples.all().delete()
                        parts = [p.strip() for p in examples_str.split(";") if p.strip()]
                        for part in parts:
                            if "|" in part:
                                jp, en = part.split("|", 1)
                                KanjiExample.objects.create(kanji=obj, sentence_jp=jp.strip(), sentence_en=en.strip())
                            else:
                                KanjiExample.objects.create(kanji=obj, sentence_jp=part.strip(), sentence_en="")

                messages.success(request, f"Imported Kanji. created={created}, updated={updated}")
                return redirect("../")
        else:
            form = KanjiCsvImportForm()

        return render(request, "admin/import_form.html", {"form": form, "title": "Import Kanji CSV"})


@admin.register(Vocabulary)
class VocabularyAdmin(admin.ModelAdmin):
    list_display = ("word", "jlpt_level", "meaning_en")
    list_filter = ("jlpt_level",)
    search_fields = ("word", "reading", "meaning_en")
    actions = [export_vocab_csv]
    change_list_template = "admin/content/vocabulary/change_list.html"

    def get_urls(self):  # type: ignore[no-untyped-def]
        urls = super().get_urls()
        custom = [
            path(
                "export-all/",
                self.admin_site.admin_view(self.export_all_view),
                name="content_vocabulary_export_all",
            ),
            path(
                "import-csv/",
                self.admin_site.admin_view(self.import_csv_view),
                name="content_vocabulary_import_csv",
            ),
        ]
        return custom + urls

    def export_all_view(self, request: HttpRequest):
        from django.utils import timezone

        ts = timezone.now().strftime("%Y%m%d_%H%M%S")
        res = _csv_response(f"vocab_export_all_{ts}.csv")
        _write_vocab(csv.writer(res), Vocabulary.objects.all())
        return res

    def import_csv_view(self, request: HttpRequest):
        if request.method == "POST":
            form = VocabCsvImportForm(request.POST, request.FILES)
            if form.is_valid():
                reader = _decode_csv(form.cleaned_data["csv_file"])
                if not reader.fieldnames:
                    messages.error(request, "CSV has no headers.")
                    return redirect("../")
                normalized = {h.strip().lower(): h for h in reader.fieldnames if h}
                for req in ["word", "meaning_en"]:
                    if req not in normalized:
                        messages.error(request, f"Missing required header: {req}")
                        return redirect("../")

                created = 0
                updated = 0
                missing_kanji = set()
                for idx, raw in enumerate(reader, start=2):
                    def get(name: str) -> str:
                        return (raw.get(normalized.get(name, name)) or "").strip()

                    word = get("word")
                    if not word:
                        messages.error(request, f"Invalid word at line {idx}.")
                        return redirect("../")

                    level = get("jlpt_level") or JLPTLevel.N2
                    if level not in {c for c, _ in JLPTLevel.choices}:
                        messages.error(request, f"Invalid jlpt_level at line {idx}.")
                        return redirect("../")

                    reading = get("reading")
                    defaults = {
                        "meaning_en": get("meaning_en"),
                        "jlpt_level": level,
                    }
                    obj, was_created = Vocabulary.objects.update_or_create(word=word, reading=reading, defaults=defaults)
                    created += 1 if was_created else 0
                    updated += 0 if was_created else 1

                    rel = get("related_kanji")
                    if rel:
                        chars = [c.strip() for c in rel.replace(",", ";").split(";") if c.strip()]
                        kanji_qs = list(Kanji.objects.filter(character__in=chars))
                        have = {k.character for k in kanji_qs}
                        for ch in chars:
                            if ch not in have:
                                missing_kanji.add(ch)
                        obj.related_kanji.set(kanji_qs)

                if missing_kanji:
                    messages.warning(
                        request,
                        f"Some related_kanji were not found and were skipped: {' '.join(sorted(missing_kanji))}",
                    )

                messages.success(request, f"Imported Vocabulary. created={created}, updated={updated}")
                return redirect("../")
        else:
            form = VocabCsvImportForm()

        return render(request, "admin/import_form.html", {"form": form, "title": "Import Vocabulary CSV"})
