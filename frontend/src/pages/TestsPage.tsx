import { useEffect, useState } from "react";
import { api } from "../app/api/client";
import { formatDuration, getLearningStylePlan, testFitScore } from "../app/learningStyle";
import { useMe } from "../app/state/user";
import { PageHeader } from "../components/PageHeader";
import type { Paginated, Test } from "../types";

export function TestsPage() {
  const { me } = useMe();
  const plan = getLearningStylePlan(me?.profile);
  const [items, setItems] = useState<Test[]>([]);
  const [level, setLevel] = useState<string>(me?.profile.jlpt_level ?? "N2");
  const [testType, setTestType] = useState<string>("");
  const [recommendedOnly, setRecommendedOnly] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (level) qs.set("jlpt_level", level);
    if (testType) qs.set("test_type", testType);

    api<Paginated<Test>>(`/tests/?${qs.toString()}`)
      .then((d) => setItems(d.results))
      .catch((e) => setError(String(e.message ?? e)));
  }, [level, testType]);

  const visibleItems = [...items]
    .map((test) => ({ test, fit: testFitScore(test, plan) }))
    .filter(({ fit }) => !recommendedOnly || fit >= 5)
    .sort((a, b) => b.fit - a.fit)
    .map(({ test }) => test);

  return (
    <div>
      <PageHeader title="Tests" subtitle={`${plan.label}: ${plan.studyCue}`} />

      <div className="notice notice--ok">
        <strong>{plan.label} test setup:</strong> aim for about {plan.defaultQuestionCount} questions or {plan.sessionMinutes} minutes.
      </div>

      <div className="toolbar">
        <select className="field" value={level} onChange={(e) => setLevel(e.target.value)} style={{ maxWidth: 140 }}>
          <option value="">All</option>
          <option value="N5">N5</option>
          <option value="N4">N4</option>
          <option value="N3">N3</option>
          <option value="N2">N2</option>
          <option value="N1">N1</option>
        </select>
        <select className="field" value={testType} onChange={(e) => setTestType(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">All test types</option>
          <option value="kanji">kanji</option>
          <option value="vocab">vocab</option>
          <option value="listening">listening</option>
          <option value="mixed">mixed</option>
        </select>
        <button className={recommendedOnly ? "btn btn--active" : "btn"} onClick={() => setRecommendedOnly((v) => !v)}>
          Recommended
        </button>
      </div>

      {error ? <div className="card">Error: {error}</div> : null}
      <div className="grid">
        {visibleItems.map((t) => (
          <div className="card" key={t.id} style={{ gridColumn: "span 6" }}>
            <div className="card__title">{t.title}</div>
            <div style={{ color: "rgba(255,255,255,0.7)" }}>{t.test_type}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <span className="pill">{t.jlpt_level}</span>
              <span className="pill">{t.timed ? `Timed: ${formatDuration(t.duration_seconds)}` : "Untimed"}</span>
              <span className="pill">{t.questions.length} questions</span>
              {testFitScore(t, plan) >= 5 ? <span className="pill">Good fit</span> : null}
            </div>
          </div>
        ))}
        {visibleItems.length === 0 && !error ? (
          <div className="card" style={{ gridColumn: "span 12" }}>
            {items.length ? "No recommended tests match these filters." : "No tests yet."}
          </div>
        ) : null}
      </div>
    </div>
  );
}
