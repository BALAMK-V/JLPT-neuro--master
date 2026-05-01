import { useEffect, useRef, useState } from "react";
import { api } from "../app/api/client";
import { formatDuration, getLearningStylePlan, testFitScore } from "../app/learningStyle";
import { useMe } from "../app/state/user";
import { PageHeader } from "../components/PageHeader";
import type { Paginated, Test, TestQuestion } from "../types";

// ── Level / type badge helpers ────────────────────────────────────────────────

const LEVEL_CLASS: Record<string, string> = {
  N5: "level-badge level-badge--n5",
  N4: "level-badge level-badge--n4",
  N3: "level-badge level-badge--n3",
  N2: "level-badge level-badge--n2",
  N1: "level-badge level-badge--n1",
};

const TYPE_CLASS: Record<string, string> = {
  kanji: "type-badge type-badge--kanji",
  vocab: "type-badge type-badge--vocab",
  listening: "type-badge type-badge--listening",
  mixed: "type-badge type-badge--mixed",
};

const TYPE_ICON: Record<string, string> = {
  kanji: "漢",
  vocab: "語",
  listening: "♪",
  mixed: "✦",
};

// ── Quiz runner types ─────────────────────────────────────────────────────────

type QuizPhase = "idle" | "running" | "results" | "review";

interface QuizState {
  test: Test;
  answers: Record<number, string>; // questionId → "A"|"B"|"C"|"D"
  qIdx: number;
  phase: QuizPhase;
  elapsed: number; // seconds
  reviewIdx: number;
}

function score(questions: TestQuestion[], answers: Record<number, string>): number {
  return questions.filter((q) => answers[q.id] === q.correct_answer).length;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TestsPage() {
  const { me } = useMe();
  const plan = getLearningStylePlan(me?.profile);

  const [items, setItems] = useState<Test[]>([]);
  const [level, setLevel] = useState<string>(me?.profile.jlpt_level ?? "N2");
  const [testType, setTestType] = useState<string>("");
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch tests ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const qs = new URLSearchParams();
    if (level) qs.set("jlpt_level", level);
    if (testType) qs.set("test_type", testType);

    api<Paginated<Test>>(`/tests/?${qs.toString()}`)
      .then((d) => setItems(d.results))
      .catch((e) => setError(String(e.message ?? e)));
  }, [level, testType]);

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!quiz || quiz.phase !== "running") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setQuiz((q) => {
        if (!q) return q;
        const next = q.elapsed + 1;
        if (q.test.timed && next >= q.test.duration_seconds) {
          clearInterval(timerRef.current!);
          return { ...q, elapsed: next, phase: "results" };
        }
        return { ...q, elapsed: next };
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [quiz?.phase]);

  // ── Filtered / sorted list ─────────────────────────────────────────────────
  const visibleItems = [...items]
    .map((test) => ({ test, fit: testFitScore(test, plan) }))
    .filter(({ fit }) => !recommendedOnly || fit >= 5)
    .sort((a, b) => b.fit - a.fit)
    .map(({ test }) => test);

  // ── Quiz actions ─────────────────────────────────────────────────────────────
  const startTest = (test: Test) => {
    if (!test.questions.length) return;
    setQuiz({ test, answers: {}, qIdx: 0, phase: "running", elapsed: 0, reviewIdx: 0 });
  };

  const pick = (qId: number, opt: string) => {
    setQuiz((q) => q ? { ...q, answers: { ...q.answers, [qId]: opt } } : q);
  };

  const submit = () => {
    setQuiz((q) => q ? { ...q, phase: "results" } : q);
  };

  const closeQuiz = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setQuiz(null);
  };

  // ── Render: quiz overlay ───────────────────────────────────────────────────
  if (quiz) {
    const { test, answers, qIdx, phase, elapsed } = quiz;
    const questions = test.questions;
    const currentQ: TestQuestion | undefined = questions[qIdx];
    const totalQ = questions.length;
    const answered = Object.keys(answers).length;
    const finalScore = score(questions, answers);
    const pct = Math.round((finalScore / totalQ) * 100);
    const pass = pct >= 60;

    const timeLeft = test.timed ? Math.max(0, test.duration_seconds - elapsed) : null;

    return (
      <div className="quiz-overlay">
        <div className="quiz-panel">
          {/* Header */}
          <div className="quiz-header">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="quiz-title">{test.title}</div>
              <div className="quiz-meta">
                <span className={LEVEL_CLASS[test.jlpt_level] ?? "level-badge"}>{test.jlpt_level}</span>
                <span className={TYPE_CLASS[test.test_type] ?? "type-badge"}>{TYPE_ICON[test.test_type] ?? "?"} {test.test_type}</span>
                {phase === "running" && (
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    {answered}/{totalQ} answered
                  </span>
                )}
              </div>
            </div>
            {timeLeft !== null && phase === "running" && (
              <div className={`quiz-timer${timeLeft < 60 ? " quiz-timer--warn" : ""}`}>
                {formatDuration(timeLeft)}
              </div>
            )}
            <button className="btn" style={{ marginLeft: 12 }} onClick={closeQuiz}>✕ Exit</button>
          </div>

          {/* Progress bar */}
          {phase === "running" && (
            <div className="quiz-progress-track">
              <div
                className="quiz-progress-fill"
                style={{ width: `${((qIdx + 1) / totalQ) * 100}%` }}
              />
            </div>
          )}

          {/* ── Running phase ── */}
          {phase === "running" && currentQ && (
            <div className="quiz-body">
              <div className="quiz-q-num">Question {qIdx + 1} / {totalQ}</div>
              <div className="quiz-question">{currentQ.prompt}</div>

              <div className="quiz-options">
                {Object.entries(currentQ.choices ?? {}).map(([key, text]) => {
                  const selected = answers[currentQ.id] === key;
                  return (
                    <button
                      key={key}
                      className={`quiz-option${selected ? " quiz-option--selected" : ""}`}
                      onClick={() => pick(currentQ.id, key)}
                    >
                      <span className="quiz-option__key">{key}</span>
                      <span className="quiz-option__text">{text}</span>
                    </button>
                  );
                })}
              </div>

              <div className="quiz-nav">
                <button className="btn" disabled={qIdx === 0} onClick={() => setQuiz((q) => q ? { ...q, qIdx: q.qIdx - 1 } : q)}>
                  ← Previous
                </button>
                {qIdx < totalQ - 1 ? (
                  <button className="btn btn--primary" onClick={() => setQuiz((q) => q ? { ...q, qIdx: q.qIdx + 1 } : q)}>
                    Next →
                  </button>
                ) : (
                  <button className="btn btn--primary" onClick={submit}>
                    Submit test
                  </button>
                )}
              </div>

              {/* Question dots */}
              <div className="quiz-dots">
                {questions.map((q, i) => (
                  <button
                    key={q.id}
                    className={`quiz-dot${i === qIdx ? " quiz-dot--current" : ""}${answers[q.id] ? " quiz-dot--done" : ""}`}
                    onClick={() => setQuiz((s) => s ? { ...s, qIdx: i } : s)}
                    title={`Q${i + 1}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Results phase ── */}
          {phase === "results" && (
            <div className="quiz-body">
              <div className={`quiz-result-score${pass ? " quiz-result-score--pass" : " quiz-result-score--fail"}`}>
                {pct}%
              </div>
              <div className="quiz-result-label">
                {pass ? "Passed!" : "Keep practicing!"}
              </div>
              <div style={{ textAlign: "center", fontSize: 14, color: "var(--muted)", marginBottom: 24 }}>
                {finalScore} / {totalQ} correct
                {test.timed && <span style={{ marginLeft: 12 }}>· Time: {formatDuration(elapsed)}</span>}
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  className="btn btn--primary"
                  onClick={() => setQuiz((q) => q ? { ...q, phase: "review", reviewIdx: 0 } : q)}
                >
                  Review answers
                </button>
                <button className="btn" onClick={() => startTest(test)}>Try again</button>
                <button className="btn" onClick={closeQuiz}>Back to tests</button>
              </div>
            </div>
          )}

          {/* ── Review phase ── */}
          {phase === "review" && (() => {
            const rq = questions[quiz.reviewIdx];
            const userAns = answers[rq.id] ?? null;
            const correct = rq.correct_answer;
            const isRight = userAns === correct;

            return (
              <div className="quiz-body">
                <div className="quiz-q-num">
                  Review: {quiz.reviewIdx + 1} / {totalQ}
                  <span style={{ marginLeft: 10, color: isRight ? "var(--good)" : "var(--bad)" }}>
                    {isRight ? "✓ Correct" : "✗ Wrong"}
                  </span>
                </div>
                <div className="quiz-question">{rq.prompt}</div>

                <div className="quiz-options">
                  {Object.entries(rq.choices ?? {}).map(([key, text]) => {
                    let cls = "quiz-option";
                    if (key === correct) cls += " quiz-option--correct";
                    else if (key === userAns && !isRight) cls += " quiz-option--wrong";
                    return (
                      <div key={key} className={cls}>
                        <span className="quiz-option__key">{key}</span>
                        <span className="quiz-option__text">{text}</span>
                        {key === correct && <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--good)" }}>✓</span>}
                      </div>
                    );
                  })}
                </div>

                {rq.explanation && (
                  <div className="quiz-explanation">{rq.explanation}</div>
                )}

                <div className="quiz-nav">
                  <button className="btn" disabled={quiz.reviewIdx === 0} onClick={() => setQuiz((q) => q ? { ...q, reviewIdx: q.reviewIdx - 1 } : q)}>
                    ← Prev
                  </button>
                  {quiz.reviewIdx < totalQ - 1 ? (
                    <button className="btn btn--primary" onClick={() => setQuiz((q) => q ? { ...q, reviewIdx: q.reviewIdx + 1 } : q)}>
                      Next →
                    </button>
                  ) : (
                    <button className="btn" onClick={() => setQuiz((q) => q ? { ...q, phase: "results" } : q)}>
                      Back to results
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ── Render: test list ──────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Tests"
        subtitle={`${plan.label} — aim for ${plan.defaultQuestionCount} questions or ${plan.sessionMinutes} min`}
      />

      {/* Filters */}
      <div className="tests-filters">
        <div className="tests-filters__group">
          {(["", "N5", "N4", "N3", "N2", "N1"] as const).map((l) => (
            <button
              key={l || "all"}
              className={level === l ? "btn btn--primary" : "btn"}
              style={{ minWidth: 52, fontWeight: level === l ? 700 : undefined }}
              onClick={() => setLevel(l)}
            >
              {l || "All"}
            </button>
          ))}
        </div>

        <div className="tests-filters__group">
          {[
            { v: "", label: "All types" },
            { v: "kanji", label: "漢 Kanji" },
            { v: "vocab", label: "語 Vocab" },
            { v: "listening", label: "♪ Listening" },
            { v: "mixed", label: "✦ Mixed" },
          ].map(({ v, label }) => (
            <button
              key={v || "all"}
              className={testType === v ? "btn btn--primary" : "btn"}
              style={{ fontSize: 13 }}
              onClick={() => setTestType(v)}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          className={recommendedOnly ? "btn btn--primary" : "btn"}
          style={{ marginLeft: "auto", fontSize: 13 }}
          onClick={() => setRecommendedOnly((v) => !v)}
        >
          {recommendedOnly ? "★ Recommended" : "☆ Recommended"}
        </button>
      </div>

      {/* Summary */}
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, paddingLeft: 4 }}>
        {visibleItems.length} test{visibleItems.length !== 1 ? "s" : ""} shown
        {recommendedOnly && " · recommended for your learning style"}
      </div>

      {error && <div className="card" style={{ color: "var(--bad)" }}>Error: {error}</div>}

      {/* Test cards */}
      <div className="grid">
        {visibleItems.map((t) => {
          const fit = testFitScore(t, plan);
          const hasQs = t.questions.length > 0;
          return (
            <div className="card test-card" key={t.id} style={{ gridColumn: "span 6" }}>
              <div className="test-card__header">
                <span className={LEVEL_CLASS[t.jlpt_level] ?? "level-badge"}>{t.jlpt_level}</span>
                <span className={TYPE_CLASS[t.test_type] ?? "type-badge"}>
                  {TYPE_ICON[t.test_type] ?? "?"} {t.test_type}
                </span>
                {fit >= 5 && <span className="fit-badge">★ Good fit</span>}
              </div>

              <div className="test-card__title">{t.title}</div>

              <div className="test-card__meta">
                <span className="pill">{t.questions.length} question{t.questions.length !== 1 ? "s" : ""}</span>
                {t.timed && <span className="pill">⏱ {formatDuration(t.duration_seconds)}</span>}
                {!t.timed && <span className="pill">Untimed</span>}
              </div>

              <button
                className="btn btn--primary test-card__start"
                disabled={!hasQs}
                onClick={() => startTest(t)}
                title={!hasQs ? "This test has no questions yet" : undefined}
              >
                {hasQs ? "Start Test →" : "No questions"}
              </button>
            </div>
          );
        })}

        {visibleItems.length === 0 && !error && (
          <div className="card" style={{ gridColumn: "span 12", textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              {items.length ? "No tests match the current filters." : "No tests available yet."}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {recommendedOnly
                ? "Try turning off the Recommended filter to see all tests."
                : "Tests are created in the Admin panel."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
