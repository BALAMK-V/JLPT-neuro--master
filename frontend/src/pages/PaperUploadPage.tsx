import { useEffect, useRef, useState } from "react";
import type { JLPTLevel, ParsedQuestion, QuestionPaper } from "../api/exam";
import { examApi } from "../api/exam";
import {
  editableToParsed,
  parsedToEditable,
  QuestionEditor,
  type EditableQuestion,
} from "../components/exam/QuestionEditor";

const POLL_INTERVAL_MS = 3000;

function StatusBadge({ status }: { status: QuestionPaper["status"] }) {
  const labels: Record<QuestionPaper["status"], string> = {
    pending: "Pending",
    processing: "Processing…",
    completed: "Completed",
    failed: "Failed",
  };
  return <span className={`pill pill--${status}`}>{labels[status]}</span>;
}

interface ImportStatus {
  examId: number;
  examTitle: string;
  count: number;
}

export function PaperUploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [level, setLevel] = useState<JLPTLevel>("N3");
  const [examTitle, setExamTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Active paper (just uploaded or selected from history)
  const [activePaper, setActivePaper] = useState<QuestionPaper | null>(null);

  // Editor state
  const [editableQuestions, setEditableQuestions] = useState<EditableQuestion[]>([]);
  const [savingEdits, setSavingEdits] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  // AI parse state
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState(false); // true = editor shows AI questions

  // Import state
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // History
  const [papers, setPapers] = useState<QuestionPaper[]>([]);

  useEffect(() => {
    examApi.getPapers().then(setPapers).catch(() => {});
  }, []);

  // Poll while OCR is running
  useEffect(() => {
    if (!activePaper || activePaper.status !== "processing") return;
    const timer = setInterval(async () => {
      try {
        const updated = await examApi.getPaper(activePaper.id);
        setActivePaper(updated);
        setPapers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        if (updated.status !== "processing") {
          clearInterval(timer);
          if (updated.status === "completed") loadEditor(updated, false);
        }
      } catch {
        clearInterval(timer);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [activePaper?.id, activePaper?.status]);

  function loadEditor(paper: QuestionPaper, fromAi: boolean) {
    const source = fromAi ? paper.ai_parsed_questions : paper.parsed_questions;
    setEditableQuestions((source ?? []).map((q, i) => parsedToEditable(q, i)));
    setAiSource(fromAi);
    setImportStatus(null);
    setSavedMsg(false);
  }

  // ── Upload ──────────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(f);
    if (f && !examTitle) setExamTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);
    setActivePaper(null);
    setEditableQuestions([]);
    setAiSource(false);
    setImportStatus(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("level", level);

    try {
      const result = await examApi.uploadPaper(formData);
      setActivePaper(result);
      setPapers((prev) => [result, ...prev]);
      // If somehow already completed (very fast OCR), load editor immediately
      if (result.status === "completed") loadEditor(result, false);
    } catch (e) {
      setUploadError(String(e));
    } finally {
      setUploading(false);
    }
  }

  // ── AI Parse ────────────────────────────────────────────────────────────────

  async function handleAiParse() {
    if (!activePaper) return;
    setAiParsing(true);
    setAiError(null);
    try {
      const res = await examApi.aiParsePaper(activePaper.id);
      const updated = { ...activePaper, ai_parsed_questions: res.ai_parsed_questions };
      setActivePaper(updated as QuestionPaper);
      setPapers((prev) => prev.map((p) => (p.id === updated.id ? (updated as QuestionPaper) : p)));
      loadEditor(updated as QuestionPaper, true);
    } catch (e) {
      const msg = String(e);
      setAiError(
        msg.includes("ANTHROPIC_API_KEY")
          ? "AI parsing requires an ANTHROPIC_API_KEY. Add it to backend/.env and restart the server."
          : msg
      );
    } finally {
      setAiParsing(false);
    }
  }

  function handleUseOcrQuestions() {
    if (!activePaper) return;
    loadEditor(activePaper, false);
  }

  // ── Save edits ──────────────────────────────────────────────────────────────

  async function handleSaveEdits() {
    if (!activePaper) return;
    setSavingEdits(true);
    setSaveError(null);
    setSavedMsg(false);
    try {
      const payload: ParsedQuestion[] = editableQuestions.map((q, i) =>
        editableToParsed(q, i + 1)
      );
      const res = await examApi.updateParsedQuestions(activePaper.id, payload);
      const updated = { ...activePaper, parsed_questions: res.parsed_questions };
      setActivePaper(updated as QuestionPaper);
      setPapers((prev) => prev.map((p) => (p.id === updated.id ? (updated as QuestionPaper) : p)));
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 3000);
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSavingEdits(false);
    }
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!activePaper) return;
    setImporting(true);
    setImportError(null);
    try {
      const title = examTitle || `Imported from ${activePaper.original_filename}`;
      const res = await examApi.importParsedQuestions(activePaper.id, title, activePaper.level);
      setImportStatus({ examId: res.exam_id, examTitle: res.exam_title, count: res.questions_imported });
    } catch (e) {
      setImportError(String(e));
    } finally {
      setImporting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="paper-upload">
      <h2>Upload Question Paper</h2>
      <p className="paper-upload__desc">
        Upload a scanned JLPT question paper (PDF or image). OCR extracts the text, then
        optionally use the <strong>AI Clean</strong> button to remove noise and structure
        questions properly. Edit anything manually before importing to an exam.
      </p>

      {/* ── Step 1: Upload form ────────────────────────────────────────────── */}
      <div className="paper-upload__form card">
        <h3 className="paper-upload__step">Step 1 — Upload file</h3>

        <div className="paper-upload__row">
          <label className="paper-upload__label">File (PDF, JPG, PNG…)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.bmp,.tiff,.webp,.pdf"
            onChange={handleFileChange}
            className="paper-upload__file-input"
          />
          {selectedFile && <span className="paper-upload__filename">{selectedFile.name}</span>}
        </div>

        <div className="paper-upload__row">
          <label className="paper-upload__label">JLPT Level</label>
          <div className="paper-upload__levels">
            {(["N5", "N4", "N3", "N2", "N1"] as JLPTLevel[]).map((lvl) => (
              <button
                key={lvl}
                className={`pill ${level === lvl ? "pill--active" : ""}`}
                onClick={() => setLevel(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="paper-upload__row">
          <label className="paper-upload__label">Exam title (used when importing)</label>
          <input
            type="text"
            className="paper-upload__text-input"
            value={examTitle}
            onChange={(e) => setExamTitle(e.target.value)}
            placeholder="e.g. JLPT N3 2024 July"
          />
        </div>

        {uploadError && <div className="error-banner">{uploadError}</div>}

        <button
          className="btn paper-upload__btn"
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
        >
          {uploading ? "Uploading…" : "Upload & Extract (OCR)"}
        </button>
      </div>

      {/* ── Step 2: OCR status + AI parse ─────────────────────────────────── */}
      {activePaper && (
        <div className="paper-upload__status card">
          <div className="paper-upload__status-header">
            <h3 className="paper-upload__step">Step 2 — OCR & AI Clean</h3>
            <div className="paper-upload__status-meta">
              <span>{activePaper.original_filename}</span>
              <StatusBadge status={activePaper.status} />
            </div>
          </div>

          {activePaper.status === "processing" && (
            <div className="paper-upload__processing">
              <span className="spinner" /> OCR is running in the background…
            </div>
          )}

          {activePaper.status === "failed" && (
            <div className="error-banner">OCR failed: {activePaper.error_message}</div>
          )}

          {activePaper.status === "completed" && (
            <div className="paper-upload__ai-section">
              <p className="paper-upload__ocr-note">
                OCR found <strong>{activePaper.parsed_questions?.length ?? 0}</strong> items
                (may include instructions, examples, watermarks).
              </p>

              <div className="paper-upload__ai-controls">
                <button
                  className="btn paper-upload__ai-btn"
                  onClick={handleAiParse}
                  disabled={aiParsing}
                >
                  {aiParsing
                    ? "AI is cleaning…"
                    : activePaper.ai_parsed_questions?.length
                    ? "Re-run AI Clean"
                    : "✨ AI Clean (remove noise)"}
                </button>

                {activePaper.ai_parsed_questions?.length ? (
                  <button
                    className={`btn ${aiSource ? "" : "btn--outline"}`}
                    onClick={() => loadEditor(activePaper, true)}
                  >
                    Use AI result ({activePaper.ai_parsed_questions.length} questions)
                  </button>
                ) : null}

                <button
                  className={`btn ${!aiSource ? "" : "btn--outline"}`}
                  onClick={handleUseOcrQuestions}
                >
                  Use OCR result ({activePaper.parsed_questions?.length ?? 0} questions)
                </button>
              </div>

              {aiError && <div className="error-banner">{aiError}</div>}

              {aiParsing && (
                <p className="paper-upload__ai-note">
                  Claude is reading the OCR text and removing instructions, examples, watermarks…
                  This takes ~10–20 seconds.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Manual editor ─────────────────────────────────────────── */}
      {activePaper?.status === "completed" && editableQuestions.length >= 0 && (
        <div className="paper-upload__editor card">
          <div className="paper-upload__editor-header">
            <h3 className="paper-upload__step">Step 3 — Review &amp; Edit</h3>
            {aiSource && (
              <span className="pill pill--ai">AI-cleaned</span>
            )}
          </div>

          <p className="paper-upload__editor-hint">
            Edit question text, fix options, mark the correct answer, delete noise, add missing
            questions. Click <strong>Save edits</strong> to commit your changes.
          </p>

          {saveError && <div className="error-banner">{saveError}</div>}
          {savedMsg && <div className="success-banner">Edits saved successfully.</div>}

          <QuestionEditor
            questions={editableQuestions}
            onChange={setEditableQuestions}
            saving={savingEdits}
            onSave={handleSaveEdits}
          />
        </div>
      )}

      {/* ── Step 4: Import ────────────────────────────────────────────────── */}
      {activePaper?.status === "completed" && (
        <div className="paper-upload__import card">
          <h3 className="paper-upload__step">Step 4 — Import to Exam</h3>
          <p>
            Save your edits first, then import the <strong>{activePaper.parsed_questions?.length ?? 0}</strong>{" "}
            questions into a new JLPT exam.
          </p>

          {importError && <div className="error-banner">{importError}</div>}

          {importStatus ? (
            <div className="success-banner">
              Imported <strong>{importStatus.count}</strong> questions into "
              <strong>{importStatus.examTitle}</strong>" (Exam ID {importStatus.examId}).
              Go to JLPT Exam to start it.
            </div>
          ) : (
            <button className="btn" onClick={handleImport} disabled={importing}>
              {importing ? "Importing…" : `Import ${activePaper.parsed_questions?.length ?? 0} questions`}
            </button>
          )}
        </div>
      )}

      {/* ── Upload history ────────────────────────────────────────────────── */}
      {papers.length > 0 && (
        <div className="paper-upload__history">
          <h3>Upload History</h3>
          <table className="paper-upload__table">
            <thead>
              <tr>
                <th>File</th>
                <th>Level</th>
                <th>Status</th>
                <th>OCR</th>
                <th>AI</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {papers.map((p) => (
                <tr key={p.id}>
                  <td>{p.original_filename}</td>
                  <td>{p.level}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>{p.parsed_questions?.length ?? "–"}</td>
                  <td>{p.ai_parsed_questions?.length ?? "–"}</td>
                  <td>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td>
                    {p.status === "completed" && (
                      <button
                        className="btn btn--sm"
                        onClick={() => {
                          setActivePaper(p);
                          loadEditor(p, (p.ai_parsed_questions?.length ?? 0) > 0);
                          setImportStatus(null);
                        }}
                      >
                        Open
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
