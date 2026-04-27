import type { Vocab } from "../types";

export function VocabCard({ vocab, onAddNote }: { vocab: Vocab; onAddNote?: () => void }) {
  return (
    <div className="card" style={{ gridColumn: "span 6" }}>
      <div className="card__title">
        <span style={{ fontSize: 22 }}>{vocab.word}</span> <span className="pill">{vocab.jlpt_level}</span>
      </div>
      <div style={{ color: "rgba(255,255,255,0.75)" }}>{vocab.reading || "—"}</div>
      <div style={{ marginTop: 8 }}>{vocab.meaning_en}</div>
      {onAddNote ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <button className="btn" onClick={onAddNote}>
            Add note
          </button>
        </div>
      ) : null}
    </div>
  );
}
