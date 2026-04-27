import type { NeuroProfileResult } from "../../types";

export function ResultScreen({ result, onRestart }: { result: NeuroProfileResult; onRestart: () => void }) {
  const summary = result.summary;
  return (
    <section className="neuro-result">
      <div className="neuro-result__hero">
        <span className="pill">{result.summary.title.replace(" learning pattern", "")}</span>
        <h2>{summary.title}</h2>
        <p>{summary.explanation}</p>
      </div>

      <div className="neuro-result__grid">
        <div>
          <div className="card__title">Strengths</div>
          <ul className="list">
            {summary.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="card__title">Watchpoints</div>
          <ul className="list">
            {summary.weaknesses.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="notice notice--ok">
        <strong>Recommended learning style:</strong> {summary.recommended_learning_style}
      </div>

      <div className="actions">
        <button className="btn" onClick={onRestart}>
          Retake analysis
        </button>
      </div>
    </section>
  );
}
