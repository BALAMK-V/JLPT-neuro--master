import { useMemo, useState } from "react";

export type Mcq = {
  prompt: string;
  choices: Record<string, string>; // {A: '...', ...}
  correct_answer: string;
  explanation?: string;
};

export function TestScreen({ mcq, onNext }: { mcq: Mcq; onNext?: (correct: boolean) => void }) {
  const keys = useMemo(() => Object.keys(mcq.choices).sort(), [mcq.choices]);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const correct = submitted && selected === mcq.correct_answer;

  return (
    <div className="card" style={{ gridColumn: "span 12" }}>
      <div className="card__title">Test</div>
      <div style={{ marginBottom: 10 }}>{mcq.prompt}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {keys.map((k) => (
          <button
            key={k}
            className="btn"
            onClick={() => !submitted && setSelected(k)}
            style={{
              textAlign: "left",
              opacity: submitted && selected !== k ? 0.6 : 1,
              borderColor: submitted && k === mcq.correct_answer ? "rgba(36,209,143,0.8)" : undefined,
            }}
          >
            {k}. {mcq.choices[k]}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
        {!submitted ? (
          <button
            className="btn"
            onClick={() => {
              if (!selected) return;
              setSubmitted(true);
              onNext?.(selected === mcq.correct_answer);
            }}
          >
            Submit
          </button>
        ) : (
          <button className="btn" onClick={() => window.location.reload()}>
            Next
          </button>
        )}
      </div>

      {submitted ? (
        <div style={{ marginTop: 12, color: correct ? "rgba(36,209,143,0.9)" : "rgba(255,92,122,0.9)" }}>
          {correct ? "Correct" : `Wrong. Correct answer: ${mcq.correct_answer}`}
          {mcq.explanation ? <div style={{ color: "rgba(255,255,255,0.7)", marginTop: 6 }}>{mcq.explanation}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
