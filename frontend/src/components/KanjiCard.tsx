import type { Kanji } from "../types";

export function KanjiCard({ kanji, onAddNote }: { kanji: Kanji; onAddNote?: () => void }) {
  return (
    <div className="card" style={{ gridColumn: "span 6" }}>
      <div className="card__title">
        <span style={{ fontSize: 34, marginRight: 10 }}>{kanji.character}</span>
        <span className="pill">{kanji.jlpt_level}</span>
      </div>
      <div style={{ color: "rgba(255,255,255,0.75)", marginBottom: 10 }}>{kanji.meaning_en}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span className="pill">On: {kanji.onyomi || "—"}</span>
        <span className="pill">Kun: {kanji.kunyomi || "—"}</span>
      </div>

      {kanji.examples?.length ? (
        <div style={{ marginTop: 12, color: "rgba(255,255,255,0.75)" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Examples</div>
          <ul className="list">
            {kanji.examples.slice(0, 3).map((ex) => (
              <li key={ex.id}>
                {ex.sentence_jp}
                {ex.sentence_en ? <div style={{ color: "rgba(255,255,255,0.55)" }}>{ex.sentence_en}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
