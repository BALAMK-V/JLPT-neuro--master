import type { ReadingPassage } from "../../types";

export function ReadingPassageView({ passage }: { passage: ReadingPassage }) {
  return (
    <div className="card" style={{ gridColumn: "span 12" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className="card__title" style={{ marginBottom: 0 }}>
          {passage.title}
        </div>
        <span className="pill">{passage.jlpt_level}</span>
        <span className="pill">{passage.passage_type}</span>
      </div>

      <div className="reading" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
        {passage.text_jp}
      </div>
      {passage.text_en ? (
        <div style={{ marginTop: 12, color: "rgba(255,255,255,0.65)", whiteSpace: "pre-wrap" }}>{passage.text_en}</div>
      ) : null}
    </div>
  );
}
