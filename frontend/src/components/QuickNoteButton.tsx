import { useCallback, useMemo, useRef, useState } from "react";
import { api } from "../app/api/client";
import type { Note } from "../types";

function useDebounced(fn: () => void, ms: number) {
  const ref = useRef<number | null>(null);
  return useCallback(() => {
    if (ref.current) window.clearTimeout(ref.current);
    ref.current = window.setTimeout(fn, ms);
  }, [fn, ms]);
}

export function QuickNoteButton() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastId, setLastId] = useState<number | null>(null);

  const save = useMemo(
    () => async () => {
      if (!open) return;
      if (!content.trim()) return;
      setSaving(true);
      try {
        if (lastId) {
          await api<Note>(`/notes/${lastId}/`, "PATCH", { content });
        } else {
          const created = await api<Note>("/notes/", "POST", {
            note_type: "quick",
            content,
            reference_type: "",
            reference_id: null,
          });
          setLastId(created.id);
        }
      } finally {
        setSaving(false);
      }
    },
    [content, lastId, open]
  );

  const debouncedSave = useDebounced(save, 600);

  return (
    <>
      <button className="quicknote" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Quick Note
      </button>
      {open && (
        <div className="quicknote__panel" role="dialog" aria-label="Quick note">
          <div className="quicknote__title">
            Quick Note {saving ? <span className="pill">saving...</span> : <span className="pill">auto-save</span>}
          </div>
          <textarea
            className="quicknote__textarea"
            value={content}
            placeholder="Type anything. Capture it and return to study."
            onChange={(e) => {
              setContent(e.target.value);
              debouncedSave();
            }}
          />
          <div className="quicknote__actions">
            <button className="btn" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
