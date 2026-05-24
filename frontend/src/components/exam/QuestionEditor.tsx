import { useEffect, useState } from "react";
import { CustomSelect } from "../ui";
import type { ParsedQuestion, QuestionSection, QuestionType } from "../../api/exam";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EditableOption {
  label: string;
  text: string;
  is_correct: boolean;
}

export interface EditableQuestion {
  _key: string;
  section: QuestionSection;
  question_type: QuestionType;
  question_text: string;
  options: EditableOption[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _keyCounter = 0;
function nextKey() {
  return `q-${++_keyCounter}`;
}

const OPTION_LABELS = ["A", "B", "C", "D", "E"];

const SECTIONS: QuestionSection[] = ["vocabulary", "grammar", "reading", "listening"];
const SECTION_LABEL: Record<QuestionSection, string> = {
  vocabulary: "語彙 Vocabulary",
  grammar: "文法 Grammar",
  reading: "読解 Reading",
  listening: "聴解 Listening",
};

const QTYPES: QuestionType[] = ["multiple_choice", "image_based", "audio_based", "fill_blank", "sentence_arrange"];
const QTYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: "Multiple Choice",
  image_based: "Image-based",
  audio_based: "Audio-based",
  fill_blank: "Fill in the Blank",
  sentence_arrange: "Sentence Arrangement",
};

export function parsedToEditable(q: ParsedQuestion, index: number): EditableQuestion {
  return {
    _key: nextKey(),
    section: q.section ?? "vocabulary",
    question_type: q.question_type ?? "multiple_choice",
    question_text: q.question_text ?? "",
    options: (q.options ?? []).map((o, i) => ({
      label: o.label ?? OPTION_LABELS[i] ?? String(i + 1),
      text: o.text ?? "",
      is_correct: (o as any).is_correct ?? i === 0,
    })),
  };
}

export function editableToParsed(q: EditableQuestion, order: number): ParsedQuestion {
  return {
    section: q.section,
    order,
    question_type: q.question_type,
    question_text: q.question_text,
    options: q.options.map((o) => ({ label: o.label, text: o.text })),
  };
}

function emptyQuestion(): EditableQuestion {
  return {
    _key: nextKey(),
    section: "vocabulary",
    question_type: "multiple_choice",
    question_text: "",
    options: [
      { label: "A", text: "", is_correct: true },
      { label: "B", text: "", is_correct: false },
      { label: "C", text: "", is_correct: false },
      { label: "D", text: "", is_correct: false },
    ],
  };
}

// ─── Single question editor ───────────────────────────────────────────────────

interface QuestionRowProps {
  question: EditableQuestion;
  index: number;
  total: number;
  onChange: (q: EditableQuestion) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function QuestionRow({ question, index, total, onChange, onDelete, onMoveUp, onMoveDown }: QuestionRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableQuestion>(question);

  // Keep draft in sync when parent passes a new version (e.g. AI re-parse)
  useEffect(() => {
    setDraft(question);
  }, [question._key]);

  function save() {
    onChange(draft);
    setEditing(false);
  }

  function cancel() {
    setDraft(question);
    setEditing(false);
  }

  function setOption(i: number, field: keyof EditableOption, value: string | boolean) {
    const opts = draft.options.map((o, idx) => {
      if (field === "is_correct") {
        // radio: only one correct at a time
        return { ...o, is_correct: idx === i };
      }
      return idx === i ? { ...o, [field]: value } : o;
    });
    setDraft({ ...draft, options: opts });
  }

  function addOption() {
    if (draft.options.length >= 6) return;
    const label = OPTION_LABELS[draft.options.length] ?? String(draft.options.length + 1);
    setDraft({
      ...draft,
      options: [...draft.options, { label, text: "", is_correct: false }],
    });
  }

  function removeOption(i: number) {
    const opts = draft.options.filter((_, idx) => idx !== i);
    // Ensure at least one correct
    if (opts.length > 0 && !opts.some((o) => o.is_correct)) opts[0].is_correct = true;
    setDraft({ ...draft, options: opts });
  }

  // ── Collapsed view ──────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="qed-row">
        <div className="qed-row__left">
          <span className="qed-row__num">{index + 1}</span>
          <span className="qed-row__section-badge">{SECTION_LABEL[question.section]}</span>
          <span className="qed-row__type-badge">{QTYPE_LABEL[question.question_type]}</span>
          <p className="qed-row__text">{question.question_text || <em>(empty)</em>}</p>
          {question.options.length > 0 && (
            <div className="qed-row__opts-preview">
              {question.options.map((o) => (
                <span key={o.label} className={`qed-row__opt ${o.is_correct ? "qed-row__opt--correct" : ""}`}>
                  {o.label}: {o.text}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="qed-row__actions">
          <button className="btn btn--sm" onClick={() => setEditing(true)} title="Edit">✏️</button>
          <button className="btn btn--sm" onClick={onMoveUp} disabled={index === 0} title="Move up">↑</button>
          <button className="btn btn--sm" onClick={onMoveDown} disabled={index === total - 1} title="Move down">↓</button>
          <button className="btn btn--sm btn--danger" onClick={onDelete} title="Delete">✕</button>
        </div>
      </div>
    );
  }

  // ── Edit form ───────────────────────────────────────────────────────────────
  return (
    <div className="qed-edit">
      <div className="qed-edit__meta">
        <div className="qed-edit__field">
          <label>Section</label>
          <CustomSelect
            value={draft.section}
            onChange={(e) => setDraft({ ...draft, section: e.target.value as QuestionSection })}
          >
            {SECTIONS.map((s) => <option key={s} value={s}>{SECTION_LABEL[s]}</option>)}
          </CustomSelect>
        </div>
        <div className="qed-edit__field">
          <label>Type</label>
          <CustomSelect
            value={draft.question_type}
            onChange={(e) => setDraft({ ...draft, question_type: e.target.value as QuestionType })}
          >
            {QTYPES.map((t) => <option key={t} value={t}>{QTYPE_LABEL[t]}</option>)}
          </CustomSelect>
        </div>
      </div>

      <div className="qed-edit__field">
        <label>Question text</label>
        <textarea
          className="qed-edit__textarea"
          rows={3}
          value={draft.question_text}
          onChange={(e) => setDraft({ ...draft, question_text: e.target.value })}
          placeholder="Enter question in Japanese or English"
        />
      </div>

      <div className="qed-edit__options">
        <div className="qed-edit__options-header">
          <label>Answer options</label>
          <span className="qed-edit__options-hint">(click ✓ to mark correct answer)</span>
        </div>
        {draft.options.map((opt, i) => (
          <div key={i} className="qed-edit__option-row">
            <input
              className="qed-edit__opt-label"
              value={opt.label}
              maxLength={3}
              onChange={(e) => setOption(i, "label", e.target.value)}
            />
            <input
              className="qed-edit__opt-text"
              value={opt.text}
              onChange={(e) => setOption(i, "text", e.target.value)}
              placeholder={`Option ${opt.label}`}
            />
            <button
              className={`qed-edit__correct-btn ${opt.is_correct ? "qed-edit__correct-btn--active" : ""}`}
              onClick={() => setOption(i, "is_correct", true)}
              title="Mark as correct answer"
            >
              {opt.is_correct ? "✓ Correct" : "✓"}
            </button>
            <button
              className="btn btn--sm btn--danger"
              onClick={() => removeOption(i)}
              disabled={draft.options.length <= 1}
              title="Remove option"
            >
              ✕
            </button>
          </div>
        ))}
        {draft.options.length < 6 && (
          <button className="btn btn--sm qed-edit__add-opt" onClick={addOption}>
            + Add option
          </button>
        )}
      </div>

      <div className="qed-edit__footer">
        <button className="btn" onClick={save}>Save</button>
        <button className="btn" onClick={cancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Public editor component ──────────────────────────────────────────────────

interface QuestionEditorProps {
  questions: EditableQuestion[];
  onChange: (questions: EditableQuestion[]) => void;
  saving?: boolean;
  onSave: () => void;
}

export function QuestionEditor({ questions, onChange, saving, onSave }: QuestionEditorProps) {
  function update(index: number, q: EditableQuestion) {
    const next = [...questions];
    next[index] = q;
    onChange(next);
  }

  function remove(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...questions];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  }

  function moveDown(index: number) {
    if (index === questions.length - 1) return;
    const next = [...questions];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  }

  function addQuestion() {
    onChange([...questions, emptyQuestion()]);
  }

  return (
    <div className="question-editor">
      <div className="question-editor__toolbar">
        <span className="question-editor__count">{questions.length} questions</span>
        <button className="btn btn--sm" onClick={addQuestion}>+ Add question</button>
        <button className="btn" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save edits"}
        </button>
      </div>

      {questions.length === 0 && (
        <div className="question-editor__empty">
          No questions yet. Click "+ Add question" to add one.
        </div>
      )}

      <div className="question-editor__list">
        {questions.map((q, i) => (
          <QuestionRow
            key={q._key}
            question={q}
            index={i}
            total={questions.length}
            onChange={(updated) => update(i, updated)}
            onDelete={() => remove(i)}
            onMoveUp={() => moveUp(i)}
            onMoveDown={() => moveDown(i)}
          />
        ))}
      </div>

      {questions.length > 3 && (
        <div className="question-editor__footer">
          <button className="btn btn--sm" onClick={addQuestion}>+ Add question</button>
          <button className="btn" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save edits"}
          </button>
        </div>
      )}
    </div>
  );
}
