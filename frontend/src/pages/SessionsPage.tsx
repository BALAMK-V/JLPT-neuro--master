import { useEffect, useState } from "react";
import { api } from "../app/api/client";
import { getLearningStylePlan } from "../app/learningStyle";
import { useMe } from "../app/state/user";
import { PageHeader } from "../components/PageHeader";
import { Caption } from "../components/ui";
import type { Paginated, Session } from "../types";

export function SessionsPage() {
  const { me } = useMe();
  const plan = getLearningStylePlan(me?.profile);
  const [items, setItems] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Paginated<Session>>("/sessions/?ordering=-started_at")
      .then((d) => setItems(d.results))
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <div>
      <PageHeader title="Sessions" subtitle={`${plan.label}: ${plan.studyCue}`} />
      <div className="notice">
        <strong>Session rhythm:</strong> {plan.sessionMinutes}-minute target with reality checks every {plan.reminderMinutes} minutes.
      </div>
      {error ? <div className="card">Error: {error}</div> : null}
      <div className="grid">
        {items.map((s) => (
          <div className="card" key={s.id} style={{ gridColumn: "span 6" }}>
            <div className="card__title">{s.goal_type}</div>
            <div className="pill">
              {s.progress_count}/{s.goal_target}
            </div>
            <Caption style={{ marginTop: 8, display: "block" }}>{new Date(s.started_at).toLocaleString()}</Caption>
          </div>
        ))}
        {items.length === 0 && !error ? <div className="card" style={{ gridColumn: "span 12" }}>No sessions yet.</div> : null}
      </div>
    </div>
  );
}
