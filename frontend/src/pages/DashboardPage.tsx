import { useEffect, useState } from "react";
import { api } from "../app/api/client";
import { getLearningStylePlan } from "../app/learningStyle";
import { useMe } from "../app/state/user";
import { PageHeader } from "../components/PageHeader";
import type { Dashboard } from "../types";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Dashboard>("/dashboard/")
      .then(setData)
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  if (error) return <div className="card">Dashboard error: {error}</div>;
  if (!data) return <div className="card">Loading dashboard...</div>;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`${plan.label}: ${plan.studyCue}`} />

      <div className="grid">
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
      </div>
    </div>
  );
}
