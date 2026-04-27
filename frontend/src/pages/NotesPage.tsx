import { useEffect, useMemo, useState } from "react";
import { api } from "../app/api/client";
import { PageHeader } from "../components/PageHeader";
import type { Note, Paginated } from "../types";

export function NotesPage() {
  const [items, setItems] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Note["note_type"]>("all");

  useEffect(() => {
    api<Paginated<Note>>("/notes/?ordering=-updated_at")
      .then((d) => setItems(d.results))
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((n) => n.note_type === filter);
  }, [filter, items]);

  return (
    <div>
      <PageHeader title="Notes" subtitle="Quick notes reduce distraction. Context notes are coming next." />
      <div className="toolbar">
        <select className="field" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
          <option value="all">All</option>
          <option value="quick">Quick</option>
          <option value="context">Context</option>
          <option value="session">Session</option>
        </select>
      </div>

      {error ? <div className="card">Error: {error}</div> : null}

      <div className="grid">
        {filtered.map((n) => (
          <div className="card" key={n.id} style={{ gridColumn: "span 12" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span className="pill">{n.note_type}</span>
              <span className="pill">{new Date(n.updated_at).toLocaleString()}</span>
            </div>
            <div style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{n.content}</div>
          </div>
        ))}
        {filtered.length === 0 && !error ? <div className="card" style={{ gridColumn: "span 12" }}>No notes yet.</div> : null}
      </div>
    </div>
  );
}
