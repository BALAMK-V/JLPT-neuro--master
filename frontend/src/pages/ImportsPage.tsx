import { useEffect, useMemo, useState } from "react";
import { api } from "../app/api/client";
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
import type { FlashDeck, Paginated } from "../types";

type ImportLogEntry = {
  id: number;
  content_type: string;
  filename: string;
  file_format: string;
  rows_imported: number;
  rows_skipped: number;
  rows_updated: number;
  extra: Record<string, unknown>;
  imported_at: string;
};

type TabKey = "kanji" | "vocab" | "listening" | "reading" | "grammar" | "flashcards" | "history";
type ImportFormat = "csv" | "json" | "xlsx";

const FORMAT_LABELS: Record<ImportFormat, string> = {
  csv: "CSV — preview & edit",
  json: "JSON — direct upload",
  xlsx: "Excel — direct upload",
};

const JSON_SCHEMAS: Record<Exclude<TabKey, "flashcards" | "history">, string> = {
  kanji: `[
  { "character": "日", "meaning_en": "sun, day", "onyomi": "ニチ", "kunyomi": "ひ", "jlpt_level": "N5" }
]`,
  vocab: `[
  { "word": "食べる", "reading": "たべる", "meaning_en": "to eat", "jlpt_level": "N5" }
]`,
  listening: `[
  { "audio_file": "q1.mp3", "question": "...", "option_a": "A", "option_b": "B",
    "option_c": "C", "option_d": "D", "answer": "A", "jlpt_level": "N3" }
]`,
  reading: `[
  { "passage_title": "Title", "passage_type": "short", "jlpt_level": "N3", "text_jp": "...",
    "question": "?", "option_a": "A", "option_b": "B", "option_c": "C", "option_d": "D", "answer": "A" }
]`,
  grammar: `[
  { "prompt": "彼女___来た", "option_a": "が", "option_b": "を", "option_c": "に", "option_d": "で",
    "answer": "A", "jlpt_level": "N4" }
]`,
};

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
  const [fmt, setFmt] = useState<ImportFormat>("csv");

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Array<Record<string, string>>>([]);

  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipNames, setZipNames] = useState<string[]>([]);

  const [directFile, setDirectFile] = useState<File | null>(null);

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [status, setStatus] = useState<{ msg: string; kind: "ok" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);

  // ── Flashcard-tab state ────────────────────────────────────────────────────
  const [fcFile, setFcFile] = useState<File | null>(null);
  const [fcDecks, setFcDecks] = useState<FlashDeck[]>([]);
  const [fcDeckMode, setFcDeckMode] = useState<"existing" | "new">("existing");
  const [fcDeckId, setFcDeckId] = useState<number | "">("");
  const [fcNewDeckName, setFcNewDeckName] = useState("");
  const [fcNewDeckType, setFcNewDeckType] = useState("custom");
  const [fcNewDeckLevel, setFcNewDeckLevel] = useState("N3");
  const [fcNewDeckAlgo, setFcNewDeckAlgo] = useState("sm2");

  // ── Import history tab state ───────────────────────────────────────────────
  const [importHistory, setImportHistory] = useState<ImportLogEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    if (tab !== "history") return;
    if (historyLoaded) return;
    api<{ results: ImportLogEntry[]; count: number }>("/flash/import-log/")
      .then((d) => { setImportHistory(d.results); setHistoryLoaded(true); })
      .catch(() => {});
  }, [tab, historyLoaded]);

  const deleteHistoryEntry = async (id: number) => {
    try {
      await api(`/flash/import-log/${id}/`, "DELETE");
      setImportHistory((prev) => prev.filter((e) => e.id !== id));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (tab !== "flashcards") return;
    api<Paginated<FlashDeck>>("/flash/decks/?ordering=name&page_size=200")
      .then((data) => {
        const unlocked = data.results.filter((d) => !d.is_locked);
        setFcDecks(unlocked);
        if (unlocked.length) setFcDeckId(unlocked[0].id);
      })
      .catch(() => {});
  }, [tab]);

  const uploadFlashcards = async () => {
    if (!fcFile) { setStatus({ msg: "Choose a file first.", kind: "error" }); return; }
    if (fcDeckMode === "existing" && !fcDeckId) { setStatus({ msg: "Select a deck.", kind: "error" }); return; }
    if (fcDeckMode === "new" && !fcNewDeckName.trim()) { setStatus({ msg: "Enter a new deck name.", kind: "error" }); return; }

    setBusy(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("import_file", fcFile, fcFile.name);
      if (fcDeckMode === "existing") {
        form.append("deck_id", String(fcDeckId));
      } else {
        form.append("deck_name", fcNewDeckName.trim());
        form.append("deck_type", fcNewDeckType);
        form.append("deck_algo", fcNewDeckAlgo);
        form.append("jlpt_level", fcNewDeckLevel);
      }
      const res = await apiForm<{ deck_id: number; created: number; skipped: number }>("/flash/import/", "POST", form);
      setStatus({ msg: `Imported ${res.created} card${res.created !== 1 ? "s" : ""}${res.skipped ? `, skipped ${res.skipped}` : ""}. Deck ID: ${res.deck_id}`, kind: "ok" });
      setFcFile(null);
    } catch (e: any) {
      setStatus({ msg: String(e?.message ?? e), kind: "error" });
    } finally {
      setBusy(false);
    }
  };

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
    setFcFile(null);
    setDirectFile(null);
    setFcNewDeckName("");
    setFmt("csv");
  };

  // Upload via CSV preview flow (content tabs)
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

      await _doContentUpload(form);
    } catch (e: any) {
      setStatus({ msg: String(e?.message ?? e), kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  // Upload via direct file (JSON/XLSX)
  const uploadDirect = async () => {
    if (!directFile) {
      setStatus({ msg: "Choose a file first.", kind: "error" });
      return;
    }
    if (tab === "listening" && !zipFile && !status) {
      // Allow no ZIP — audio filenames will try to match existing stored files
    }
    setBusy(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("import_file", directFile, directFile.name);
      if (tab === "listening" && zipFile) {
        form.append("audio_zip", zipFile, zipFile.name);
      }
      await _doContentUpload(form);
    } catch (e: any) {
      setStatus({ msg: String(e?.message ?? e), kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const _doContentUpload = async (form: FormData) => {
    if (tab === "kanji") {
      const res = await apiForm<{ created: number; updated: number }>("/kanji/import/", "POST", form);
      setStatus({ msg: `Done — created ${res.created}, updated ${res.updated}`, kind: "ok" });
    } else if (tab === "vocab") {
      const res = await apiForm<{ created: number; updated: number }>("/vocab/import/", "POST", form);
      setStatus({ msg: `Done — created ${res.created}, updated ${res.updated}`, kind: "ok" });
    } else if (tab === "listening") {
      const res = await apiForm<{ created: number }>("/listening/import/", "POST", form);
      setStatus({ msg: `Imported ${res.created} listening question${res.created !== 1 ? "s" : ""}`, kind: "ok" });
    } else if (tab === "reading") {
      const res = await apiForm<{ created_passages: number; created_questions: number }>("/reading/import/", "POST", form);
      setStatus({ msg: `Done — ${res.created_passages} passage${res.created_passages !== 1 ? "s" : ""}, ${res.created_questions} question${res.created_questions !== 1 ? "s" : ""}`, kind: "ok" });
    } else {
      const res = await apiForm<{ created: number }>("/grammar/import/", "POST", form);
      setStatus({ msg: `Imported ${res.created} grammar question${res.created !== 1 ? "s" : ""}`, kind: "ok" });
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
      setStatus({ msg: `Audio ZIP uploaded — ${res.count} file${res.count !== 1 ? "s" : ""} saved`, kind: "ok" });
      setErrors(recomputeErrors(csvHeaders, csvRows, res.saved));
    } catch (e: any) {
      setStatus({ msg: String(e?.message ?? e), kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const templateHref =
    tab === "kanji" ? "/templates/kanji_import_sample.csv"
    : tab === "vocab" ? "/templates/vocab_import_sample.csv"
    : tab === "listening" ? "/templates/listening_import_sample.csv"
    : tab === "reading" ? "/templates/reading_import_sample.csv"
    : "/templates/grammar_import_sample.csv";

  const isContentTab = tab !== "flashcards";

  return (
    <div>
      <PageHeader title="Imports" subtitle="Bulk-upload content — CSV preview, JSON, or Excel." />

      {/* Tab bar */}
      <div className="tabs">
        {(["kanji", "vocab", "listening", "reading", "grammar", "flashcards", "history"] as TabKey[]).map((t) => (
          <button
            key={t}
            className={tab === t ? "tab tab--active" : "tab"}
            onClick={() => { clearAll(); setTab(t); }}
          >
            {t === "history" ? "📋 History" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Flashcards tab ─────────────────────────────────────────────────── */}
      {tab === "flashcards" && (
        <div className="grid">
          <div className="card" style={{ gridColumn: "span 12" }}>
            <div className="card__title">Step 1 — Choose file</div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
              Accepted: <strong>CSV</strong>, <strong>TSV / TXT</strong> (Anki text export),{" "}
              <strong>JSON</strong>, <strong>XLSX</strong>, <strong>APKG</strong> (Anki package).
            </p>
            <div className="toolbar">
              <input
                key="fc-file"
                className="field"
                type="file"
                accept=".csv,.tsv,.txt,.json,.xlsx,.apkg"
                onChange={(e) => { setFcFile(e.target.files?.[0] ?? null); setStatus(null); }}
              />
              <a className="btn" href="/templates/flashcards_import_sample.csv" download>
                CSV template
              </a>
            </div>
            {fcFile && <div className="pill" style={{ marginTop: 8 }}>Selected: {fcFile.name}</div>}
          </div>

          <div className="card" style={{ gridColumn: "span 12" }}>
            <div className="card__title">Step 2 — Choose target deck</div>
            <div className="toolbar" style={{ flexWrap: "wrap", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="radio" name="fc-deck-mode" value="existing" checked={fcDeckMode === "existing"} onChange={() => setFcDeckMode("existing")} />
                Existing deck
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="radio" name="fc-deck-mode" value="new" checked={fcDeckMode === "new"} onChange={() => setFcDeckMode("new")} />
                Create new deck
              </label>
            </div>

            {fcDeckMode === "existing" ? (
              fcDecks.length ? (
                <>
                  <select
                    className="field"
                    style={{ marginTop: 10, maxWidth: 360 }}
                    value={fcDeckId}
                    onChange={(e) => setFcDeckId(Number(e.target.value))}
                  >
                    {fcDecks.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  {fcDeckId && (() => {
                    const d = fcDecks.find((x) => x.id === fcDeckId);
                    if (!d) return null;
                    return (
                      <div className="fc-import-deck-info">
                        <span className={`level-badge level-badge--${d.jlpt_level.toLowerCase()}`}>{d.jlpt_level}</span>
                        <span className="type-badge">{d.deck_type}</span>
                        <span className="pill">{d.srs_algo?.toUpperCase() ?? "SM2"}</span>
                        <span className="pill">{d.total_cards} cards</span>
                        <span className="pill" style={{ color: "var(--accent)" }}>{d.due_count} due</span>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="pill" style={{ marginTop: 10 }}>No unlocked decks — create a new one instead.</div>
              )
            ) : (
              <div className="fc-import-new-deck">
                <div className="fc-import-new-deck__row">
                  <label className="fc-import-new-deck__label">Deck name</label>
                  <input
                    className="field"
                    placeholder="e.g. N3 Custom Vocab"
                    value={fcNewDeckName}
                    onChange={(e) => setFcNewDeckName(e.target.value)}
                  />
                </div>
                <div className="fc-import-new-deck__row">
                  <label className="fc-import-new-deck__label">JLPT level</label>
                  <select className="field" value={fcNewDeckLevel} onChange={(e) => setFcNewDeckLevel(e.target.value)}>
                    {["N5", "N4", "N3", "N2", "N1"].map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="fc-import-new-deck__row">
                  <label className="fc-import-new-deck__label">Deck type</label>
                  <select className="field" value={fcNewDeckType} onChange={(e) => setFcNewDeckType(e.target.value)}>
                    <option value="custom">Custom</option>
                    <option value="kanji">Kanji</option>
                    <option value="vocab">Vocabulary</option>
                    <option value="combined">Combined (kanji + vocab)</option>
                    <option value="mixed">Mixed (any content)</option>
                  </select>
                </div>
                <div className="fc-import-new-deck__row">
                  <label className="fc-import-new-deck__label">SRS algorithm</label>
                  <select className="field" value={fcNewDeckAlgo} onChange={(e) => setFcNewDeckAlgo(e.target.value)}>
                    <option value="sm2">SM-2 (classic)</option>
                    <option value="fsrs">FSRS-4.5 (advanced)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ gridColumn: "span 12" }}>
            <div className="card__title">Step 3 — Import</div>
            <button
              className="btn btn--primary"
              disabled={busy || !fcFile || (fcDeckMode === "existing" ? !fcDeckId : !fcNewDeckName.trim())}
              onClick={uploadFlashcards}
            >
              {busy ? "Importing…" : "Import flashcards"}
            </button>
            {status && (
              <div className={`notice notice--${status.kind === "ok" ? "ok" : "bad"}`} style={{ marginTop: 12 }}>
                {status.msg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Content tabs ───────────────────────────────────────────────────── */}
      {isContentTab && (
        <div className="grid">

          {/* Format selector */}
          <div className="card" style={{ gridColumn: "span 12" }}>
            <div className="card__title">Format</div>
            <div className="toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
              {(["csv", "json", "xlsx"] as ImportFormat[]).map((f) => (
                <button
                  key={f}
                  className={fmt === f ? "btn btn--primary" : "btn"}
                  style={{ fontSize: 13 }}
                  onClick={() => { setFmt(f); setStatus(null); setCsvFile(null); setCsvHeaders([]); setCsvRows([]); setDirectFile(null); setErrors([]); }}
                >
                  {FORMAT_LABELS[f]}
                </button>
              ))}
              {fmt === "csv" && (
                <a className="btn" href={templateHref} download style={{ marginLeft: "auto" }}>
                  Download CSV template
                </a>
              )}
            </div>
          </div>

          {/* ── CSV flow ── */}
          {fmt === "csv" && (
            <>
              {tab === "listening" && (
                <div className="card" style={{ gridColumn: "span 12" }}>
                  <div className="card__title">Optional — Upload audio ZIP first</div>
                  <div className="toolbar">
                    <input key={`zip-${tab}`} className="field" type="file" accept=".zip"
                      onChange={(e) => { const f = e.target.files?.[0] ?? null; setZipFile(f); setZipNames([]); }}
                    />
                    <button className="btn btn--primary" disabled={busy || !zipFile} onClick={uploadZipOnly}>
                      {busy ? "Uploading…" : "Upload ZIP"}
                    </button>
                    {zipNames.length > 0 && (
                      <button className="btn" type="button" onClick={() => download("audio_filenames.txt", zipNames.join("\n"))}>
                        Download filename list
                      </button>
                    )}
                  </div>
                  <div className="pill">{zipNames.length ? `ZIP has ${zipNames.length} files` : "No ZIP uploaded yet"}</div>
                </div>
              )}

              <div className="card" style={{ gridColumn: "span 12" }}>
                <div className="card__title">Choose CSV file</div>
                <div className="toolbar">
                  <input key={`csv-${tab}`} className="field" type="file" accept=".csv,text/csv"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) loadCsv(f); }}
                  />
                  <button className="btn" type="button" disabled={!csvHeaders.length}
                    onClick={() => {
                      setCsvRows((rows) => {
                        const empty: Record<string, string> = {};
                        for (const h of csvHeaders) empty[h] = "";
                        return [empty, ...rows];
                      });
                    }}
                  >
                    Add row
                  </button>
                  <button className="btn btn--primary" disabled={busy || !csvFile} onClick={upload}>
                    {busy ? "Uploading…" : "Upload"}
                  </button>
                </div>
                <div className="pill">{csvFile ? `Loaded: ${csvFile.name} (${csvRows.length} rows)` : "No file loaded"}</div>
              </div>

              <div className="card" style={{ gridColumn: "span 12" }}>
                <div className="card__title">Validate + preview + edit</div>
                <ValidationSummary errors={errors} />
                {csvHeaders.length ? (
                  <CsvEditor
                    headers={csvHeaders}
                    rows={csvRows}
                    errors={errors}
                    onChange={(r) => { setCsvRows(r); setErrors(recomputeErrors(csvHeaders, r, zipNames)); }}
                  />
                ) : (
                  <div className="pill">Load a CSV above to preview and edit it here.</div>
                )}
              </div>
            </>
          )}

          {/* ── JSON / XLSX direct upload flow ── */}
          {(fmt === "json" || fmt === "xlsx") && (
            <>
              {fmt === "json" && (
                <div className="card" style={{ gridColumn: "span 12" }}>
                  <div className="card__title">JSON format example</div>
                  <pre style={{ fontSize: 12, overflowX: "auto", background: "var(--code-bg)", borderRadius: 8, padding: "10px 14px", color: "var(--muted)", margin: 0 }}>
                    {JSON_SCHEMAS[tab as Exclude<TabKey, "flashcards" | "history">]}
                  </pre>
                </div>
              )}
              {fmt === "xlsx" && (
                <div className="card" style={{ gridColumn: "span 12" }}>
                  <div className="card__title">Excel format</div>
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                    First row must be column headers (same names as the CSV template).
                    Download the <a href={templateHref} download style={{ color: "var(--accent)" }}>CSV template</a> to see required column names — use those as Excel headers.
                  </p>
                </div>
              )}

              {tab === "listening" && (
                <div className="card" style={{ gridColumn: "span 12" }}>
                  <div className="card__title">Optional — Upload audio ZIP</div>
                  <div className="toolbar">
                    <input key={`zip-direct-${tab}`} className="field" type="file" accept=".zip"
                      onChange={(e) => { const f = e.target.files?.[0] ?? null; setZipFile(f); setZipNames([]); }}
                    />
                    <button className="btn btn--primary" disabled={busy || !zipFile} onClick={uploadZipOnly}>
                      {busy ? "Uploading…" : "Upload ZIP"}
                    </button>
                  </div>
                  <div className="pill">{zipNames.length ? `ZIP has ${zipNames.length} files` : "No ZIP uploaded yet"}</div>
                </div>
              )}

              <div className="card" style={{ gridColumn: "span 12" }}>
                <div className="card__title">Choose {fmt === "json" ? "JSON" : "Excel"} file</div>
                <div className="toolbar">
                  <input
                    key={`direct-${tab}-${fmt}`}
                    className="field"
                    type="file"
                    accept={fmt === "json" ? ".json,application/json" : ".xlsx,.xls"}
                    onChange={(e) => { setDirectFile(e.target.files?.[0] ?? null); setStatus(null); }}
                  />
                  <button className="btn btn--primary" disabled={busy || !directFile} onClick={uploadDirect}>
                    {busy ? "Uploading…" : "Upload"}
                  </button>
                </div>
                {directFile && <div className="pill">Selected: {directFile.name}</div>}
              </div>
            </>
          )}

          {/* Status */}
          {status && (
            <div className="card" style={{ gridColumn: "span 12" }}>
              <div className={`notice notice--${status.kind === "ok" ? "ok" : "bad"}`}>
                {status.msg}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── History tab ────────────────────────────────────────────────────── */}
      {tab === "history" && (
        <div className="card" style={{ marginTop: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div className="card__title" style={{ marginBottom: 0 }}>Import History</div>
            <button
              className="btn"
              onClick={() => { setHistoryLoaded(false); setImportHistory([]); }}
            >
              ↺ Refresh
            </button>
          </div>

          {!historyLoaded ? (
            <div className="pill">Loading…</div>
          ) : importHistory.length === 0 ? (
            <div className="pill">No imports recorded yet.</div>
          ) : (
            <div className="tablewrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>File</th>
                    <th style={{ width: 60 }}>Fmt</th>
                    <th style={{ width: 70 }}>Created</th>
                    <th style={{ width: 70 }}>Updated</th>
                    <th style={{ width: 70 }}>Skipped</th>
                    <th style={{ width: 160 }}>Imported at</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {importHistory.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <span className="pill" style={{ textTransform: "capitalize" }}>
                          {entry.content_type}
                        </span>
                      </td>
                      <td className="ui-caption" style={{ fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.filename || "—"}
                      </td>
                      <td className="ui-meta" style={{ fontSize: 12 }}>
                        {entry.file_format?.toUpperCase() || "—"}
                      </td>
                      <td className="ui-meta" style={{ fontSize: 12, color: "var(--good)" }}>
                        {entry.rows_imported}
                      </td>
                      <td className="ui-meta" style={{ fontSize: 12, color: "var(--accent)" }}>
                        {entry.rows_updated}
                      </td>
                      <td className="ui-meta" style={{ fontSize: 12, color: "var(--muted)" }}>
                        {entry.rows_skipped}
                      </td>
                      <td className="ui-meta" style={{ fontSize: 12 }}>
                        {new Date(entry.imported_at).toLocaleString()}
                      </td>
                      <td>
                        <button
                          className="btn btn--danger"
                          style={{ fontSize: 11, padding: "4px 10px" }}
                          onClick={() => deleteHistoryEntry(entry.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
