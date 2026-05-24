import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../app/api/client";
import { CustomSelect } from "../components/ui";
import type { Note } from "../types";

// ── Color palette (Google Keep) ───────────────────────────────────────────────

const NOTE_COLORS: { key: string; label: string; swatch: string }[] = [
  { key: "",        label: "Default",   swatch: "#5f6368" },
  { key: "red",     label: "Tomato",    swatch: "#F28B82" },
  { key: "pink",    label: "Flamingo",  swatch: "#FDCFE8" },
  { key: "orange",  label: "Tangerine", swatch: "#FBBC04" },
  { key: "yellow",  label: "Banana",    swatch: "#FFF475" },
  { key: "sage",    label: "Sage",      swatch: "#CCFF90" },
  { key: "mint",    label: "Basil",     swatch: "#A8F0D3" },
  { key: "teal",    label: "Peacock",   swatch: "#CBF0F8" },
  { key: "blue",    label: "Blueberry", swatch: "#AECBFA" },
  { key: "purple",  label: "Lavender",  swatch: "#D7AEFB" },
  { key: "gray",    label: "Graphite",  swatch: "#E8EAED" },
];

type FilterType = "all" | "quick" | "context" | "session";

// ── Color Picker ──────────────────────────────────────────────────────────────

function ColorPicker({
  current,
  onSelect,
}: {
  current: string;
  onSelect: (color: string) => void;
}) {
  return (
    <div className="gk-color-picker" onClick={(e) => e.stopPropagation()}>
      {NOTE_COLORS.map((c) => (
        <button
          key={c.key}
          className={`gk-color-dot${current === c.key ? " gk-color-dot--active" : ""}${c.key === "" ? " gk-color-dot--default" : ""}`}
          style={c.key ? { background: c.swatch } : undefined}
          title={c.label}
          onClick={() => onSelect(c.key)}
        />
      ))}
    </div>
  );
}

// ── Note Card ─────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  onUpdate,
  onDelete,
  onEdit,
}: {
  note: Note;
  onUpdate: (id: number, patch: Partial<Note>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onEdit: (note: Note) => void;
}) {
  const [colorOpen, setColorOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!colorOpen) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setColorOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [colorOpen]);

  return (
    <div
      ref={cardRef}
      className={`gk-card${colorOpen ? " gk-card--color-open" : ""}`}
      data-color={note.color || undefined}
      onClick={() => onEdit(note)}
    >
      {note.pinned && (
        <span className="gk-card__pin" title="Pinned">◉</span>
      )}

      {note.title && <div className="gk-card__title">{note.title}</div>}
      {note.content && <div className="gk-card__content">{note.content}</div>}

      <div className="gk-card__footer">
        <span className="gk-card__type">{note.note_type}</span>
      </div>

      {/* Hover action bar */}
      <div className="gk-card__actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="gk-icon-btn"
          title={note.pinned ? "Unpin note" : "Pin note"}
          onClick={() => onUpdate(note.id, { pinned: !note.pinned })}
        >
          {note.pinned ? "◉" : "◎"}
        </button>

        <div style={{ position: "relative" }}>
          <button
            className="gk-icon-btn"
            title="Background color"
            onClick={() => setColorOpen((v) => !v)}
          >
            ◐
          </button>
          {colorOpen && (
            <ColorPicker
              current={note.color}
              onSelect={(c) => {
                onUpdate(note.id, { color: c });
                setColorOpen(false);
              }}
            />
          )}
        </div>

        <button
          className="gk-icon-btn"
          title={note.archived ? "Unarchive" : "Archive note"}
          onClick={() => onUpdate(note.id, { archived: !note.archived })}
        >
          {note.archived ? "↑" : "⊟"}
        </button>

        <button
          className="gk-icon-btn gk-icon-btn--danger"
          title="Delete note"
          onClick={() => {
            if (window.confirm("Delete this note?")) onDelete(note.id);
          }}
        >
          ⊗
        </button>
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function NoteEditModal({
  note,
  onSave,
  onDelete,
  onClose,
}: {
  note: Note;
  onSave: (patch: Partial<Note>) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [color, setColor] = useState(note.color);
  const [pinned, setPinned] = useState(note.pinned);
  const [archived, setArchived] = useState(note.archived);
  const [colorOpen, setColorOpen] = useState(false);

  const hasChanges =
    title !== note.title ||
    content !== note.content ||
    color !== note.color ||
    pinned !== note.pinned ||
    archived !== note.archived;

  const handleClose = async () => {
    if (hasChanges) {
      await onSave({ title, content, color, pinned, archived });
    } else {
      onClose();
    }
  };

  return (
    <div className="gk-modal-overlay" onClick={handleClose}>
      <div
        className="gk-modal"
        data-color={color || undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          className="gk-modal__title"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="gk-modal__content"
          placeholder="Note…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="gk-modal__footer">
          <div className="gk-modal__actions">
            <button
              className="gk-icon-btn"
              title={pinned ? "Unpin" : "Pin note"}
              onClick={() => setPinned(!pinned)}
            >
              {pinned ? "◉" : "◎"}
            </button>

            <div style={{ position: "relative" }}>
              <button
                className="gk-icon-btn"
                title="Background color"
                onClick={() => setColorOpen(!colorOpen)}
              >
                ◐
              </button>
              {colorOpen && (
                <ColorPicker
                  current={color}
                  onSelect={(c) => {
                    setColor(c);
                    setColorOpen(false);
                  }}
                />
              )}
            </div>

            <button
              className="gk-icon-btn"
              title={archived ? "Unarchive" : "Archive note"}
              onClick={() => setArchived(!archived)}
            >
              {archived ? "↑" : "⊟"}
            </button>

            <button
              className="gk-icon-btn gk-icon-btn--danger"
              title="Delete note"
              onClick={async () => {
                if (window.confirm("Delete this note?")) await onDelete();
              }}
            >
              ⊗
            </button>
          </div>
          <button className="gk-close-btn" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newColor, setNewColor] = useState("");
  const [createColorOpen, setCreateColorOpen] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const createRef = useRef<HTMLDivElement>(null);

  const sortNotes = (arr: Note[]) =>
    [...arr].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const load = useCallback(() => {
    setLoading(true);
    api<{ results: Note[]; count: number }>("/notes/?ordering=-updated_at&page_size=500")
      .then((d) => setNotes(sortNotes(d.results)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  // Close create bar on outside click
  useEffect(() => {
    if (!creating) return;
    const handler = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        handleCreateClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creating, newTitle, newContent, newColor]);

  const handleCreateClose = async () => {
    if (newTitle.trim() || newContent.trim()) {
      await api("/notes/", "POST", {
        note_type: "quick",
        title: newTitle,
        content: newContent,
        color: newColor,
        pinned: false,
        archived: false,
        reference_type: "",
        reference_id: null,
      });
      load();
    }
    setCreating(false);
    setNewTitle("");
    setNewContent("");
    setNewColor("");
    setCreateColorOpen(false);
  };

  const updateNote = async (id: number, patch: Partial<Note>) => {
    const updated = await api<Note>(`/notes/${id}/`, "PATCH", patch);
    setNotes((prev) => sortNotes(prev.map((n) => (n.id === id ? updated : n))));
  };

  const deleteNote = async (id: number) => {
    await api(`/notes/${id}/`, "DELETE");
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const filteredNotes = notes.filter((n) => {
    if (showArchived ? !n.archived : n.archived) return false;
    if (filter !== "all" && n.note_type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pinned = filteredNotes.filter((n) => n.pinned);
  const others = filteredNotes.filter((n) => !n.pinned);
  const showSectionLabels = pinned.length > 0 && others.length > 0;

  return (
    <div className="gk-root">

      {/* ── Toolbar ── */}
      <div className="gk-toolbar">
        <div className="gk-search">
          <span className="gk-search__icon">◎</span>
          <input
            className="gk-search__input"
            placeholder="Search notes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="gk-search__clear" onClick={() => setSearch("")}>
              ✕
            </button>
          )}
        </div>
        <div className="gk-toolbar__right">
          <button
            className={`gk-icon-btn${showArchived ? " gk-icon-btn--active" : ""}`}
            onClick={() => setShowArchived(!showArchived)}
            title={showArchived ? "Back to notes" : "Show archived"}
          >
            {showArchived ? "↑" : "⊟"}
          </button>
          <button
            className="gk-icon-btn"
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            title={viewMode === "grid" ? "List view" : "Grid view"}
          >
            {viewMode === "grid" ? "≡" : "▦"}
          </button>
          <CustomSelect
            className="gk-type-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
          >
            <option value="all">All types</option>
            <option value="quick">Quick</option>
            <option value="context">Context</option>
            <option value="session">Session</option>
          </CustomSelect>
        </div>
      </div>

      {/* ── Create bar ── */}
      {!showArchived && (
        <div
          ref={createRef}
          className={`gk-create${creating ? " gk-create--open" : ""}`}
          data-color={newColor || undefined}
        >
          {creating && (
            <input
              className="gk-create__title"
              placeholder="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
          )}
          <textarea
            className="gk-create__textarea"
            placeholder="Take a note…"
            value={newContent}
            rows={creating ? 4 : 1}
            onFocus={() => setCreating(true)}
            onChange={(e) => setNewContent(e.target.value)}
          />
          {creating && (
            <div className="gk-create__footer">
              <div className="gk-create__actions">
                <div style={{ position: "relative" }}>
                  <button
                    className="gk-icon-btn"
                    title="Background color"
                    onClick={() => setCreateColorOpen(!createColorOpen)}
                  >
                    ◐
                  </button>
                  {createColorOpen && (
                    <ColorPicker
                      current={newColor}
                      onSelect={(c) => {
                        setNewColor(c);
                        setCreateColorOpen(false);
                      }}
                    />
                  )}
                </div>
              </div>
              <button className="gk-close-btn" onClick={handleCreateClose}>
                Close
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Notes grid ── */}
      {loading ? (
        <div className="gk-empty">Loading notes…</div>
      ) : (
        <>
          {pinned.length > 0 && (
            <section className="gk-section">
              {showSectionLabels && (
                <div className="gk-section__label">PINNED</div>
              )}
              <div className={viewMode === "grid" ? "gk-masonry" : "gk-list"}>
                {pinned.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    onUpdate={updateNote}
                    onDelete={deleteNote}
                    onEdit={setEditNote}
                  />
                ))}
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section className="gk-section">
              {showSectionLabels && (
                <div className="gk-section__label">OTHERS</div>
              )}
              <div className={viewMode === "grid" ? "gk-masonry" : "gk-list"}>
                {others.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    onUpdate={updateNote}
                    onDelete={deleteNote}
                    onEdit={setEditNote}
                  />
                ))}
              </div>
            </section>
          )}

          {filteredNotes.length === 0 && (
            <div className="gk-empty">
              {showArchived
                ? "No archived notes"
                : search
                ? "No notes match your search"
                : "Notes you add appear here"}
            </div>
          )}
        </>
      )}

      {/* ── Edit modal ── */}
      {editNote && (
        <NoteEditModal
          note={editNote}
          onSave={async (patch) => {
            await updateNote(editNote.id, patch);
            setEditNote(null);
          }}
          onDelete={async () => {
            await deleteNote(editNote.id);
            setEditNote(null);
          }}
          onClose={() => setEditNote(null)}
        />
      )}
    </div>
  );
}
