import { useState } from "react";
import type { ReadingPassage } from "../../types";

export function ReadingPassageView({ passage }: { passage: ReadingPassage }) {
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <div className="card" style={{ gridColumn: "span 12" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className="card__title" style={{ marginBottom: 0 }}>
          {passage.title}
        </div>
        <span className="pill">{passage.jlpt_level}</span>
        <span className="pill">{passage.passage_type}</span>
        {passage.text_en && (
          <button
            className="btn"
            style={{ marginLeft: "auto", fontSize: 12 }}
            onClick={() => setShowTranslation((v) => !v)}
          >
            {showTranslation ? "Hide Translation" : "Show Translation"}
          </button>
        )}
      </div>

      <div className="reading" style={{ marginTop: 12, whiteSpace: "pre-wrap", lineHeight: 2 }}>
        {passage.text_jp}
      </div>

      {showTranslation && passage.text_en && (
        <div style={{
          marginTop: 12,
          color: "rgba(255,255,255,0.65)",
          whiteSpace: "pre-wrap",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          paddingTop: 10,
          fontSize: 14,
          lineHeight: 1.8,
        }}>
          {passage.text_en}
        </div>
      )}
    </div>
  );
}
