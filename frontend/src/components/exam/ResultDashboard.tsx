import type { ExamResult, QuestionSection } from "../../api/exam";

const SECTION_LABELS: Record<QuestionSection, string> = {
  vocabulary: "語彙 Vocabulary",
  grammar: "文法 Grammar",
  reading: "読解 Reading",
  listening: "聴解 Listening",
};

const SECTION_COLORS: Record<QuestionSection, string> = {
  vocabulary: "#4a9eff",
  grammar: "#f59e0b",
  reading: "#10b981",
  listening: "#8b5cf6",
};

interface Props {
  result: ExamResult;
  onReview: () => void;
  onRetake?: () => void;
}

function ScoreRing({ pct }: { pct: number }) {
  const r = 44;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;

  return (
    <svg className="score-ring" viewBox="0 0 100 100" width="120" height="120">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={pct >= 60 ? "#10b981" : "#ef4444"}
        strokeWidth="8"
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="54" textAnchor="middle" className="score-ring__label" fontSize="18" fontWeight="700">
        {pct.toFixed(1)}%
      </text>
    </svg>
  );
}

function SectionBar({ label, score, color }: { label: string; score: { total: number; correct: number; percentage: number }; color: string }) {
  return (
    <div className="section-bar">
      <div className="section-bar__header">
        <span className="section-bar__label">{label}</span>
        <span className="section-bar__score">
          {score.correct}/{score.total} ({score.percentage}%)
        </span>
      </div>
      <div className="section-bar__track">
        <div
          className="section-bar__fill"
          style={{ width: `${score.percentage}%`, background: color }}
        />
        <div className="section-bar__threshold" style={{ left: "60%" }} title="Pass threshold (60%)" />
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function ResultDashboard({ result, onReview, onRetake }: Props) {
  return (
    <div className="result-dashboard">
      <div className="result-dashboard__hero">
        <ScoreRing pct={result.score_percentage} />
        <div className="result-dashboard__hero-info">
          <div className={`result-dashboard__verdict ${result.passed ? "result-dashboard__verdict--pass" : "result-dashboard__verdict--fail"}`}>
            {result.passed ? "✓ PASS" : "✗ FAIL"}
          </div>
          <div className="result-dashboard__level">{result.exam_level}</div>
          <div className="result-dashboard__title">{result.exam_title}</div>
          <div className="result-dashboard__stats">
            <span>{result.correct_answers}/{result.total_questions} correct</span>
            <span>Time: {formatTime(result.time_taken_seconds)}</span>
          </div>
        </div>
      </div>

      {/* Section scores */}
      <div className="result-dashboard__sections">
        <h3 className="result-dashboard__section-title">Section Scores</h3>
        {(Object.entries(result.section_scores) as [QuestionSection, { total: number; correct: number; percentage: number }][]).map(
          ([section, score]) => (
            <SectionBar
              key={section}
              label={SECTION_LABELS[section] ?? section}
              score={score}
              color={SECTION_COLORS[section] ?? "#6b7280"}
            />
          )
        )}
      </div>

      <div className="result-dashboard__actions">
        <button className="btn" onClick={onReview}>Review Answers</button>
        {onRetake && <button className="btn" onClick={onRetake}>Retake Exam</button>}
      </div>
    </div>
  );
}
