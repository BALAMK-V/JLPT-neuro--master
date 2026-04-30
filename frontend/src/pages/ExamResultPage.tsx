import { useEffect, useState } from "react";
import type { ExamQuestionWithAnswer, ExamResult } from "../api/exam";
import { examApi } from "../api/exam";
import { api } from "../app/api/client";
import { ResultAnalysisPanel } from "../components/exam/AnalysisPanel";
import { ResultDashboard } from "../components/exam/ResultDashboard";
import { ScoreHistoryChart } from "../components/ScoreHistoryChart";
import type { ExamHistoryEntry } from "../types";

const SECTION_LABEL: Record<string, string> = {
  vocabulary: "語彙 Vocabulary",
  grammar: "文法 Grammar",
  reading: "読解 Reading",
  listening: "聴解 Listening",
};

function ReviewQuestion({
  question,
  index,
}: {
  question: ExamQuestionWithAnswer;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const correct = question.user_is_correct;

  return (
    <div className={`review-q ${correct ? "review-q--correct" : "review-q--wrong"}`}>
      <button className="review-q__header" onClick={() => setOpen((o) => !o)}>
        <span className="review-q__num">Q{index + 1}</span>
        <span className="review-q__section">{SECTION_LABEL[question.section] ?? question.section}</span>
        <span className="review-q__verdict">{correct ? "✓" : "✗"}</span>
        <span className="review-q__toggle">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="review-q__body">
          {question.passage_text && (
            <p className="review-q__passage">{question.passage_text}</p>
          )}
          <p className="review-q__text">{question.question_text}</p>

          <div className="review-q__options">
            {question.options.map((opt) => {
              const isSelected = opt.id === question.user_selected_option;
              const isCorrect = opt.is_correct;
              return (
                <div
                  key={opt.id}
                  className={[
                    "review-q__option",
                    isCorrect ? "review-q__option--correct" : "",
                    isSelected && !isCorrect ? "review-q__option--wrong" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="review-q__opt-label">{opt.label}</span>
                  <span className="review-q__opt-text">{opt.text}</span>
                  {isCorrect && <span className="review-q__tag">Correct</span>}
                  {isSelected && !isCorrect && <span className="review-q__tag">Your answer</span>}
                </div>
              );
            })}
          </div>

          {question.explanation && (
            <div className="review-q__explanation">
              <strong>Explanation:</strong> {question.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  resultId: number;
  onBack: () => void;
}

export function ExamResultPage({ resultId, onBack }: Props) {
  const [result, setResult] = useState<ExamResult | null>(null);
  const [reviewQuestions, setReviewQuestions] = useState<ExamQuestionWithAnswer[]>([]);
  const [history, setHistory] = useState<ExamHistoryEntry[]>([]);
  const [tab, setTab] = useState<"summary" | "review" | "history">("summary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      examApi.getResult(resultId),
      examApi.getResultReview(resultId),
      api<ExamHistoryEntry[]>("/exam-results/history/").catch(() => [] as ExamHistoryEntry[]),
    ])
      .then(([r, review, hist]) => {
        setResult(r);
        setReviewQuestions(review);
        setHistory(hist);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [resultId]);

  if (loading) return <div className="loading">Loading result…</div>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!result) return null;

  return (
    <div className="exam-result-page">
      <div className="exam-result-page__topbar">
        <button className="btn" onClick={onBack}>← Back</button>
        <h2>{result.exam_title} — Result</h2>
      </div>

      <div className="exam-result-page__tabs">
        {(["summary", "review", "history"] as const).map((t) => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? "tab-btn--active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "summary" ? "Summary & Analysis" : t === "review" ? "Review Questions" : "Score History"}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <>
          <ResultDashboard result={result} onReview={() => setTab("review")} />
          <ResultAnalysisPanel result={result} />
        </>
      )}

      {tab === "review" && (
        <div className="review-list">
          <p className="review-list__hint">
            {result.correct_answers}/{result.total_questions} correct — expand each question to see details.
          </p>
          {reviewQuestions.map((q, i) => (
            <ReviewQuestion key={q.id} question={q} index={i} />
          ))}
        </div>
      )}

      {tab === "history" && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card__title">Your exam score history</div>
          <ScoreHistoryChart history={history} />
        </div>
      )}
    </div>
  );
}
