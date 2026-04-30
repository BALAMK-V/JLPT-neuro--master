import { useState } from "react";
import { api } from "../app/api/client";
import type { Vocab } from "../types";

type ExplanationData = {
  word: string;
  reading: string;
  jlpt_level: string;
  explanation: string;
};

function ExplainModal({ vocabId, word, onClose }: { vocabId: number; word: string; onClose: () => void }) {
  const [data, setData] = useState<ExplanationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useState(() => {
    api<ExplanationData>(`/vocab/${vocabId}/explain/`, "POST")
      .then(setData)
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  });

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ maxWidth: 520, width: "100%", position: "relative" }}>
        <button
          className="btn"
          style={{ position: "absolute", top: 10, right: 10 }}
          onClick={onClose}
        >
          ✕
        </button>
        <div className="card__title" style={{ marginRight: 40 }}>
          AI Explanation — {word}
        </div>
        {loading && <div className="pill" style={{ marginTop: 10 }}>Asking Claude...</div>}
        {error && (
          <div style={{ color: "#ff5c7a", marginTop: 10, fontSize: 13 }}>
            {error.includes("not configured") ? "AI not configured — add ANTHROPIC_API_KEY to your .env file." : error}
          </div>
        )}
        {data && (
          <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "rgba(255,255,255,0.85)" }}>
            {data.explanation}
          </div>
        )}
      </div>
    </div>
  );
}

export function VocabCard({
  vocab,
  onAddNote,
  showFurigana = false,
}: {
  vocab: Vocab;
  onAddNote?: () => void;
  showFurigana?: boolean;
}) {
  const [showExplain, setShowExplain] = useState(false);

  return (
    <div className="card" style={{ gridColumn: "span 6" }}>
      <div className="card__title">
        {showFurigana && vocab.reading ? (
          <ruby style={{ fontSize: 22, marginRight: 6 }}>
            {vocab.word}
            <rt style={{ fontSize: "0.45em", color: "rgba(255,255,255,0.6)" }}>{vocab.reading}</rt>
          </ruby>
        ) : (
          <span style={{ fontSize: 22 }}>{vocab.word}</span>
        )}{" "}
        <span className="pill">{vocab.jlpt_level}</span>
        {vocab.frequency_rank != null && (
          <span className="pill" style={{ fontSize: 11, opacity: 0.7 }}>#{vocab.frequency_rank}</span>
        )}
      </div>
      {!showFurigana && (
        <div style={{ color: "rgba(255,255,255,0.75)" }}>{vocab.reading || "—"}</div>
      )}
      <div style={{ marginTop: 8 }}>{vocab.meaning_en}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
        <button className="btn" onClick={() => setShowExplain(true)}>
          Explain
        </button>
        {onAddNote ? (
          <button className="btn" onClick={onAddNote}>
            Add note
          </button>
        ) : null}
      </div>
      {showExplain && (
        <ExplainModal vocabId={vocab.id} word={vocab.word} onClose={() => setShowExplain(false)} />
      )}
    </div>
  );
}
