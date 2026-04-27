import { useMemo, useState } from "react";

import type { ReadingQuestion } from "../../types";

export function ReadingMcq({ q }: { q: ReadingQuestion }) {
  const choices = useMemo(
    () => [
      { key: "A", text: q.option_a },
      { key: "B", text: q.option_b },
      { key: "C", text: q.option_c },
      { key: "D", text: q.option_d },
    ],
    [q]
  );

  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const correct = selected === q.answer;

  return (
    <div className="card" style={{ gridColumn: "span 12" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div className="card__title" style={{ marginBottom: 0 }}>Q{q.order || q.id}</div>
        <span className="pill">{q.question_type || "other"}</span>
      </div>
      <div style={{ marginBottom: 10 }}>{q.question}</div>

      <div style={{ display: "grid", gap: 8 }}>
        {choices.map((c) => (
          <button
            key={c.key}
            className="btn"
            onClick={() => !submitted && setSelected(c.key)}
            style={{
              textAlign: "left",
              opacity: submitted && selected !== c.key ? 0.6 : 1,
              borderColor: submitted && c.key === q.answer ? "rgba(36,209,143,0.8)" : undefined,
            }}
          >
            {c.key}. {c.text}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
        {!submitted ? (
          <button
            className="btn btn--primary"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              setSubmitted(true);
            }}
          >
            Check
          </button>
        ) : (
          <span className="pill" style={{ color: correct ? "rgba(36,209,143,0.95)" : "rgba(255,92,122,0.95)" }}>
            {correct ? "Correct" : `Wrong (Answer: ${q.answer})`}
          </span>
        )}
      </div>

      {submitted && q.explanation ? (
        <div style={{ marginTop: 10, color: "rgba(255,255,255,0.75)" }}>{q.explanation}</div>
      ) : null}
    </div>
  );
}
