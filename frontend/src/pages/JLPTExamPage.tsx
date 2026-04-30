import { useEffect, useRef, useState } from "react";
import type { AnswerPayload, ExamResult, JLPTExamDetail, JLPTExamSummary, JLPTLevel, UserExamSession } from "../api/exam";
import { examApi } from "../api/exam";
import { ResultAnalysisPanel } from "../components/exam/AnalysisPanel";
import { NavigationPanel } from "../components/exam/NavigationPanel";
import { QuestionCard } from "../components/exam/QuestionCard";
import { ResultDashboard } from "../components/exam/ResultDashboard";
import { TimerDisplay } from "../components/exam/TimerDisplay";

type Phase = "list" | "running" | "submitting";

const LEVEL_DURATION: Record<JLPTLevel, number> = {
  N5: 75,
  N4: 85,
  N3: 105,
  N2: 120,
  N1: 145,
};

export function JLPTExamPage() {
  const [phase, setPhase] = useState<Phase>("list");
  const [exams, setExams] = useState<JLPTExamSummary[]>([]);
  const [examDetail, setExamDetail] = useState<JLPTExamDetail | null>(null);
  const [session, setSession] = useState<UserExamSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, AnswerPayload>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [levelFilter, setLevelFilter] = useState<JLPTLevel | "">("");

  const timerRemainingRef = useRef<number>(0);

  useEffect(() => {
    examApi
      .listExams(levelFilter || undefined)
      .then((data) => setExams(data.results ?? (data as any)))
      .catch((e) => setError(String(e)));
  }, [levelFilter]);

  async function startExam(exam: JLPTExamSummary) {
    setLoading(true);
    setError(null);
    try {
      const detail = await examApi.getExam(exam.id);
      const sess = await examApi.startExam(exam.id);
      setExamDetail(detail);
      setSession(sess);
      setAnswers(new Map());
      setCurrentIndex(0);
      timerRemainingRef.current = sess.time_remaining_seconds || exam.duration_minutes * 60;
      setPhase("running");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleAnswer(payload: AnswerPayload) {
    setAnswers((prev) => new Map(prev).set(payload.question, payload));
  }

  async function submitExam(timeRemaining: number) {
    if (!session || !examDetail) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        answers: Array.from(answers.values()),
        time_remaining_seconds: timeRemaining,
      };
      const res = await examApi.submitExam(session.id, payload);
      setResult(res);
      setPhase("submitting");
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  function handleTimerExpire() {
    submitExam(0);
  }

  // ── Exam list ──────────────────────────────────────────────────────────────
  if (phase === "list") {
    return (
      <div className="exam-list">
        <div className="exam-list__header">
          <h2>JLPT Exams</h2>
          <div className="exam-list__filters">
            {(["", "N5", "N4", "N3", "N2", "N1"] as const).map((lvl) => (
              <button
                key={lvl || "all"}
                className={`pill ${levelFilter === lvl ? "pill--active" : ""}`}
                onClick={() => setLevelFilter(lvl)}
              >
                {lvl || "All"}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}
        {loading && <div className="loading">Loading…</div>}

        {exams.length === 0 && !loading && (
          <div className="exam-list__empty">
            <p>No exams published yet.</p>
            <p>Use the admin panel or question paper upload to create exams.</p>
          </div>
        )}

        <div className="exam-list__grid">
          {exams.map((exam) => (
            <div key={exam.id} className="exam-card">
              <div className="exam-card__level">{exam.level}</div>
              <div className="exam-card__title">{exam.title}</div>
              <div className="exam-card__meta">
                <span>{exam.question_count} questions</span>
                <span>{exam.duration_minutes} min</span>
                <span>{exam.section_type.replace("_", " ")}</span>
              </div>
              {exam.description && (
                <p className="exam-card__desc">{exam.description}</p>
              )}
              <button
                className="btn exam-card__btn"
                onClick={() => startExam(exam)}
                disabled={loading}
              >
                Start Exam
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Result screen ──────────────────────────────────────────────────────────
  if (phase === "submitting" && result) {
    return (
      <div className="exam-result">
        <ResultDashboard
          result={result}
          onReview={() => { window.location.hash = `#examResult/${result.id}`; }}
          onRetake={() => { setPhase("list"); setResult(null); }}
        />
        <ResultAnalysisPanel result={result} />
      </div>
    );
  }

  // ── Running exam ───────────────────────────────────────────────────────────
  if (!examDetail || !session) return null;
  const questions = examDetail.questions;
  const current = questions[currentIndex];

  return (
    <div className="exam-runner">
      <div className="exam-runner__topbar">
        <div className="exam-runner__info">
          <span className="exam-runner__level">{examDetail.level}</span>
          <span className="exam-runner__title">{examDetail.title}</span>
        </div>
        <TimerDisplay
          initialSeconds={timerRemainingRef.current}
          onExpire={handleTimerExpire}
          paused={submitting}
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="exam-runner__body">
        <div className="exam-runner__question">
          {current && (
            <QuestionCard
              question={current}
              answer={answers.get(current.id)}
              onAnswer={handleAnswer}
              questionNumber={currentIndex + 1}
              totalQuestions={questions.length}
            />
          )}

          <div className="exam-runner__nav-btns">
            <button
              className="btn"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
            >
              Previous
            </button>
            <button
              className="btn"
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              disabled={currentIndex === questions.length - 1}
            >
              Next
            </button>
          </div>
        </div>

        <aside className="exam-runner__sidebar">
          <NavigationPanel
            questions={questions}
            currentIndex={currentIndex}
            answers={answers}
            onNavigate={setCurrentIndex}
            onSubmit={() => submitExam(timerRemainingRef.current)}
            submitting={submitting}
          />
        </aside>
      </div>
    </div>
  );
}
