import { useMemo, useState } from "react";
import { apiForm } from "../app/api/form";
import { PageHeader } from "../components/PageHeader";
import { CsvEditor } from "../components/imports/CsvEditor";
import { parseCsv, serializeCsv } from "../components/imports/csv";
import {
  crossCheckAudioFilenames,
  validateGrammar,
  validateKanji,
  validateListening,
  validateReading,
  validateVocab,
  type ValidationError,
} from "../components/imports/validators";
import { ValidationSummary } from "../components/imports/ValidationSummary";

type TabKey = "kanji" | "vocab" | "listening" | "reading" | "grammar";

function fileToText(file: File) {
  return file.text();
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportsPage() {
  const [tab, setTab] = useState<TabKey>("kanji");

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Array<Record<string, string>>>([]);

  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipNames, setZipNames] = useState<string[]>([]);

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [status, setStatus] = useState<{ msg: string; kind: "ok" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);

  const validator = useMemo(() => {
    if (tab === "kanji") return validateKanji;
    if (tab === "vocab") return validateVocab;
    if (tab === "listening") return validateListening;
    if (tab === "reading") return validateReading;
    return validateGrammar;
  }, [tab]);

  const recomputeErrors = (headers: string[], rows: Array<Record<string, string>>, names: string[]) => {
    const base = validator(headers, rows);
    if (tab === "listening") return base.concat(crossCheckAudioFilenames(rows, names));
    return base;
  };

  const loadCsv = async (file: File) => {
    setStatus(null);
    setBusy(true);
    try {
      const text = await fileToText(file);
      const parsed = parseCsv(text);
      setCsvFile(file);
      setCsvHeaders(parsed.headers.map((h) => h.trim()));
      setCsvRows(parsed.rows);
      setErrors(recomputeErrors(parsed.headers, parsed.rows, zipNames));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setZipFile(null);
    setZipNames([]);
    setErrors([]);
    setStatus(null);
  };

  const upload = async () => {
    if (!csvFile) {
      setStatus({ msg: "Please choose a CSV file first.", kind: "error" });
      return;
    }

    const currentErrors = recomputeErrors(csvHeaders, csvRows, zipNames);
    setErrors(currentErrors);
    if (currentErrors.length) {
      setStatus({ msg: "Fix validation errors before uploading.", kind: "error" });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const payloadCsv = serializeCsv(csvHeaders, csvRows);
      const form = new FormData();
      form.append("csv_file", new Blob([payloadCsv], { type: "text/csv" }), csvFile.name);

      if (tab === "listening" && zipFile) {
        form.append("audio_zip", zipFile, zipFile.name);
      }

      if (tab === "kanji") {
        const res = await apiForm<{ created: number; updated: number }>("/kanji/import/", "POST", form);
        setStatus({ msg: `Uploaded. created=${res.created}, updated=${res.updated}`, kind: "ok" });
      } else if (tab === "vocab") {
        const res = await apiForm<{ created: number; updated: number }>("/vocab/import/", "POST", form);
        setStatus({ msg: `Uploaded. created=${res.created}, updated=${res.updated}`, kind: "ok" });
      } else if (tab === "listening") {
        const res = await apiForm<{ created: number }>("/listening/import/", "POST", form);
        setStatus({ msg: `Uploaded listening questions. created=${res.created}`, kind: "ok" });
      } else if (tab === "reading") {
        const res = await apiForm<{ created_passages: number; created_questions: number }>("/reading/import/", "POST", form);
        setStatus({ msg: `Uploaded reading. passages=${res.created_passages}, questions=${res.created_questions}`, kind: "ok" });
      } else {
        const res = await apiForm<{ created: number }>("/grammar/import/", "POST", form);
        setStatus({ msg: `Uploaded grammar. created=${res.created}`, kind: "ok" });
      }
    } catch (e: any) {
      setStatus({ msg: String(e?.message ?? e), kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const uploadZipOnly = async () => {
    if (!zipFile) {
      setStatus({ msg: "Please choose an audio ZIP first.", kind: "error" });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("audio_zip", zipFile, zipFile.name);
      const res = await apiForm<{ saved: string[]; count: number }>("/listening/audio/import/", "POST", form);
      setZipNames(res.saved);
      setStatus({ msg: `Audio ZIP uploaded. Files saved: ${res.count}`, kind: "ok" });
      setErrors(recomputeErrors(csvHeaders, csvRows, res.saved));
    } catch (e: any) {
      setStatus({ msg: String(e?.message ?? e), kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const templateHref =
    tab === "kanji"
      ? "/templates/kanji_import_sample.csv"
      : tab === "vocab"
        ? "/templates/vocab_import_sample.csv"
        : tab === "listening"
          ? "/templates/listening_import_sample.csv"
          : tab === "reading"
            ? "/templates/reading_import_sample.csv"
            : "/templates/grammar_import_sample.csv";

  const templateLabel =
    tab === "kanji"
      ? "Download Kanji CSV"
      : tab === "vocab"
        ? "Download Vocab CSV"
        : tab === "listening"
          ? "Download Listening CSV"
          : tab === "reading"
            ? "Download Reading CSV"
            : "Download Grammar CSV";

  return (
    <div>
      <PageHeader title="Imports" subtitle="Validate -> preview -> edit -> upload." />

      <div className="tabs">
        <button className={tab === "kanji" ? "tab tab--active" : "tab"} onClick={() => { clearAll(); setTab("kanji"); }}>
          Kanji
        </button>
        <button className={tab === "vocab" ? "tab tab--active" : "tab"} onClick={() => { clearAll(); setTab("vocab"); }}>
          Vocabulary
        </button>
        <button className={tab === "listening" ? "tab tab--active" : "tab"} onClick={() => { clearAll(); setTab("listening"); }}>
          Listening
        </button>
        <button className={tab === "reading" ? "tab tab--active" : "tab"} onClick={() => { clearAll(); setTab("reading"); }}>
          Reading
        </button>
        <button className={tab === "grammar" ? "tab tab--active" : "tab"} onClick={() => { clearAll(); setTab("grammar"); }}>
          Grammar
        </button>
      </div>

      <div className="grid">
        <div className="card" style={{ gridColumn: "span 12" }}>
          <div className="card__title">Step 1 - Download a template</div>
          <div className="toolbar">
            <a className="btn" href={templateHref} download>
              {templateLabel}
            </a>
          </div>
        </div>

        {tab === "listening" ? (
          <div className="card" style={{ gridColumn: "span 12" }}>
            <div className="card__title">Optional - Upload audio ZIP and get filename list</div>
            <div className="toolbar">
              <input
                key={`zip-${tab}`}
                className="field"
                type="file"
                accept=".zip"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setZipFile(f);
                  setZipNames([]);
                }}
              />
              <button className="btn btn--primary" disabled={busy || !zipFile} onClick={uploadZipOnly}>
                {busy ? "Working..." : "Upload ZIP"}
              </button>
              {zipNames.length ? (
                <button className="btn" type="button" onClick={() => download("audio_filenames.txt", zipNames.join("\n"))}>
                  Download filename list
                </button>
              ) : null}
            </div>
            {zipNames.length ? <div className="pill">ZIP contains {zipNames.length} files</div> : <div className="pill">No ZIP uploaded yet</div>}
          </div>
        ) : null}

        <div className="card" style={{ gridColumn: "span 12" }}>
          <div className="card__title">Step 2 - Choose CSV</div>
          <div className="toolbar">
            <input
              key={`csv-${tab}`}
              className="field"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadCsv(f);
              }}
            />
            <button
              className="btn"
              type="button"
              onClick={() => {
                setCsvRows((rows) => {
                  const empty: Record<string, string> = {};
                  for (const h of csvHeaders) empty[h] = "";
                  return [empty, ...rows];
                });
              }}
              disabled={!csvHeaders.length}
            >
              Add row
            </button>
            <button className="btn btn--primary" disabled={busy || !csvFile} onClick={upload}>
              {busy ? "Uploading..." : "Upload"}
            </button>
          </div>
          {csvFile ? <div className="pill">Loaded: {csvFile.name} ({csvRows.length} rows)</div> : <div className="pill">No CSV loaded yet</div>}
        </div>

        <div className="card" style={{ gridColumn: "span 12" }}>
          <div className="card__title">Step 3 - Validate + preview + edit</div>
          <ValidationSummary errors={errors} />
          {csvHeaders.length ? (
            <CsvEditor
              headers={csvHeaders}
              rows={csvRows}
              errors={errors}
              onChange={(r) => {
                setCsvRows(r);
                setErrors(recomputeErrors(csvHeaders, r, zipNames));
              }}
            />
          ) : (
            <div className="pill">Upload a CSV to preview it here.</div>
          )}
        </div>

        {status ? (
          <div className="card" style={{ gridColumn: "span 12" }}>
            <div className="card__title">Status</div>
            <div className={status.kind === "ok" ? "notice notice--ok" : "notice notice--bad"}>
              {status.msg}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
