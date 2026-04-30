import type { ExamResult, QuestionSection, UserAnalysis } from "../../api/exam";

const SECTION_LABELS: Record<QuestionSection, string> = {
  vocabulary: "語彙 Vocabulary",
  grammar: "文法 Grammar",
  reading: "読解 Reading",
  listening: "聴解 Listening",
};

// ─── Single-result weak area panel ────────────────────────────────────────────

interface ResultAnalysisPanelProps {
  result: ExamResult;
}

export function ResultAnalysisPanel({ result }: ResultAnalysisPanelProps) {
  if (!result.weak_areas.length && !result.study_suggestions.length) {
    return (
      <div className="analysis-panel analysis-panel--empty">
        <p>Great performance! No significant weak areas detected.</p>
      </div>
    );
  }

  return (
    <div className="analysis-panel">
      {result.weak_areas.length > 0 && (
        <section className="analysis-panel__section">
          <h3 className="analysis-panel__heading">Weak Areas Detected</h3>
          <ul className="analysis-panel__list analysis-panel__list--weak">
            {result.weak_areas.map((area) => (
              <li key={area} className="analysis-panel__item analysis-panel__item--weak">
                <span className="analysis-panel__icon">⚠</span>
                {area}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.study_suggestions.length > 0 && (
        <section className="analysis-panel__section">
          <h3 className="analysis-panel__heading">Study Suggestions</h3>
          <ul className="analysis-panel__list analysis-panel__list--suggestions">
            {result.study_suggestions.map((s) => (
              <li key={s} className="analysis-panel__item analysis-panel__item--suggestion">
                <span className="analysis-panel__icon">💡</span>
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ─── Aggregate analysis panel (across all exams) ──────────────────────────────

interface UserAnalysisPanelProps {
  analysis: UserAnalysis;
}

function TrendChart({ values, label }: { values: number[]; label: string }) {
  if (!values.length) return null;

  const maxVal = Math.max(...values, 100);
  const w = 160;
  const h = 48;
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
    const y = h - (v / maxVal) * h;
    return `${x},${y}`;
  });

  return (
    <div className="trend-chart">
      <div className="trend-chart__label">{label}</div>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="trend-chart__svg">
        <line x1="0" y1={h * 0.4} x2={w} y2={h * 0.4} stroke="#10b98133" strokeWidth="1" strokeDasharray="4" />
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {values.map((v, i) => {
          const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
          const y = h - (v / maxVal) * h;
          return <circle key={i} cx={x} cy={y} r="3" fill="var(--accent)" />;
        })}
      </svg>
      {values.length > 0 && (
        <div className="trend-chart__last">{values[values.length - 1].toFixed(0)}%</div>
      )}
    </div>
  );
}

export function UserAnalysisPanel({ analysis }: UserAnalysisPanelProps) {
  return (
    <div className="analysis-panel analysis-panel--user">
      <div className="analysis-panel__overview">
        <div className="analysis-panel__stat">
          <div className="analysis-panel__stat-value">{analysis.total_exams}</div>
          <div className="analysis-panel__stat-label">Exams taken</div>
        </div>
        <div className="analysis-panel__stat">
          <div className="analysis-panel__stat-value">{analysis.recent_score.toFixed(1)}%</div>
          <div className="analysis-panel__stat-label">Latest score</div>
        </div>
      </div>

      {/* Section trends */}
      {Object.keys(analysis.section_trends).length > 0 && (
        <section className="analysis-panel__section">
          <h3 className="analysis-panel__heading">Score Trends (last 5 exams)</h3>
          <div className="analysis-panel__trends">
            {(Object.entries(analysis.section_trends) as [QuestionSection, number[]][]).map(([sec, vals]) => (
              <TrendChart key={sec} values={vals} label={SECTION_LABELS[sec] ?? sec} />
            ))}
          </div>
        </section>
      )}

      {/* Persistent weak areas */}
      {analysis.persistent_weak_areas.length > 0 && (
        <section className="analysis-panel__section">
          <h3 className="analysis-panel__heading">Persistent Weak Areas</h3>
          <ul className="analysis-panel__list">
            {analysis.persistent_weak_areas.slice(0, 4).map(({ area, occurrences }) => (
              <li key={area} className="analysis-panel__item analysis-panel__item--weak">
                <span className="analysis-panel__icon">⚠</span>
                <span>{area}</span>
                <span className="analysis-panel__badge">{occurrences}×</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Study suggestions */}
      {analysis.top_suggestions.length > 0 && (
        <section className="analysis-panel__section">
          <h3 className="analysis-panel__heading">Top Study Suggestions</h3>
          <ul className="analysis-panel__list">
            {analysis.top_suggestions.map((s) => (
              <li key={s} className="analysis-panel__item analysis-panel__item--suggestion">
                <span className="analysis-panel__icon">💡</span>
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
