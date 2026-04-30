import { useEffect, useState } from "react";
import { api } from "../app/api/client";
import { getLearningStylePlan } from "../app/learningStyle";
import { useMe } from "../app/state/user";
import { ScoreHistoryChart } from "../components/ScoreHistoryChart";
import { PageHeader } from "../components/PageHeader";
import type { Dashboard, ExamHistoryEntry } from "../types";

function recommendationText(rec: Record<string, unknown>, fallbackMinutes: number) {
  const title = typeof rec.title === "string" ? rec.title : null;
  const detail = typeof rec.detail === "string" ? rec.detail : null;
  if (title && detail) return { title, detail };

  if (rec.type === "reviews") {
    return { title: "Due reviews", detail: `Clear ${rec.count ?? "your"} due reviews in a ${fallbackMinutes}-minute block.` };
  }
  if (rec.type === "practice") {
    return { title: "Weak area practice", detail: `Practice ${rec.item_type ?? "your weakest area"} next.` };
  }
  return { title: "Study next", detail: "Pick a small review block and keep momentum steady." };
}

export function DashboardPage() {
  const { me } = useMe();
  const plan = getLearningStylePlan(me?.profile);
  const [data, setData] = useState<Dashboard | null>(null);
  const [history, setHistory] = useState<ExamHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Dashboard>("/dashboard/"),
      api<ExamHistoryEntry[]>("/exam-results/history/").catch(() => [] as ExamHistoryEntry[]),
    ])
      .then(([dash, hist]) => {
        setData(dash);
        setHistory(hist);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  if (error) return <div className="card">Dashboard error: {error}</div>;
  if (!data) return <div className="card">Loading dashboard...</div>;

  const flashDue = data.flash_due_count ?? 0;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`${plan.label}: ${plan.studyCue}`} />

      <div className="grid">
        {/* Stats */}
        <div className="card">
          <div className="card__title">Today</div>
          <div className="metric">
            <div className="metric__label">Due reviews</div>
            <div className="metric__value">{data.due_reviews}</div>
          </div>
          <div className="metric">
            <div className="metric__label">Avg accuracy</div>
            <div className="metric__value">{data.avg_accuracy}%</div>
          </div>
          <div className="metric">
            <div className="metric__label">Target block</div>
            <div className="metric__value">{plan.sessionMinutes}m</div>
          </div>
        </div>

        {/* Unified flashcard queue */}
        <div className="card">
          <div className="card__title">Flashcard queue</div>
          <div className="metric">
            <div className="metric__label">Due cards (all decks)</div>
            <div className="metric__value" style={{ color: flashDue > 0 ? "#ffcc66" : "inherit" }}>
              {flashDue}
            </div>
          </div>
          {flashDue > 0 ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 8 }}>
                Cards are due across one or more decks. Open Flashcards to review all at once.
              </div>
              <span className="pill">Unified queue ready</span>
            </div>
          ) : (
            <div style={{ marginTop: 8, color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
              All caught up — no cards due right now.
            </div>
          )}
        </div>

        {/* Weak areas */}
        <div className="card">
          <div className="card__title">Weak areas</div>
          <ul className="list">
            {data.weak_areas.map((w) => (
              <li key={w.item_type}>
                {w.item_type}: {Math.round(w.avg)}% ({w.count})
              </li>
            ))}
            {!data.weak_areas.length ? <li>No weak areas yet.</li> : null}
          </ul>
        </div>

        {/* Recommendations */}
        <div className="card" style={{ gridColumn: "span 4" }}>
          <div className="card__title">Recommended next</div>
          <div style={{ display: "grid", gap: 10 }}>
            {data.recommendations.map((rec, index) => {
              const copy = recommendationText(rec, plan.sessionMinutes);
              const action = typeof rec.action === "string" ? rec.action : `${plan.defaultQuestionCount} item target`;
              return (
                <div className="notice" key={`${copy.title}-${index}`} style={{ marginBottom: 0 }}>
                  <div style={{ fontWeight: 900 }}>{copy.title}</div>
                  <div style={{ color: "rgba(255,255,255,0.72)", marginTop: 6 }}>{copy.detail}</div>
                  <div className="pill" style={{ display: "inline-flex", marginTop: 8 }}>{action}</div>
                </div>
              );
            })}
            {!data.recommendations.length ? (
              <div className="notice" style={{ marginBottom: 0 }}>
                <div style={{ fontWeight: 900 }}>Start a study block</div>
                <div style={{ color: "rgba(255,255,255,0.72)", marginTop: 6 }}>{plan.studyCue}</div>
                <div className="pill" style={{ display: "inline-flex", marginTop: 8 }}>{plan.sessionMinutes} minutes</div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Top unknown words by frequency */}
        {data.top_unknown_words?.length > 0 && (
          <div className="card" style={{ gridColumn: "span 6" }}>
            <div className="card__title">Most Common Words You Haven't Learned</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {data.top_unknown_words.map((w) => (
                <div key={w.id} style={{
                  display: "flex", alignItems: "baseline", gap: 10,
                  background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "7px 10px",
                }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", minWidth: 28 }}>
                    #{w.frequency_rank}
                  </span>
                  <span style={{ fontSize: 17, fontWeight: 600 }}>{w.word}</span>
                  {w.reading && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{w.reading}</span>}
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginLeft: "auto" }}>{w.meaning_en}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Score history chart */}
        <div className="card" style={{ gridColumn: "span 6" }}>
          <div className="card__title">Exam score history</div>
          <ScoreHistoryChart history={history} />
        </div>
      </div>
    </div>
  );
}
