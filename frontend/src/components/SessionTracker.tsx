import { useEffect, useMemo, useState } from "react";
import { getLearningStylePlan } from "../app/learningStyle";
import { useMe } from "../app/state/user";

export type SessionState = {
  goalLabel: string;
  target: number;
  progress: number;
  startedAt: number;
};

export function SessionTracker({ state, onRealityCheck }: { state: SessionState; onRealityCheck?: () => void }) {
  const { me } = useMe();
  const plan = getLearningStylePlan(me?.profile);
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => {
      const mins = Math.floor((Date.now() - state.startedAt) / 60000);
      setMinutes(mins);
      if (mins > 0 && mins % plan.reminderMinutes === 0) onRealityCheck?.();
    }, 5000);
    return () => window.clearInterval(t);
  }, [onRealityCheck, plan.reminderMinutes, state.startedAt]);

  const pct = useMemo(() => (state.target ? Math.min(100, Math.round((state.progress / state.target) * 100)) : 0), [state]);

  return (
    <div className="card" style={{ gridColumn: "span 12" }}>
      <div className="card__title">Session</div>
      <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.75)" }}>
        <div>{state.goalLabel}</div>
        <div>{minutes}/{plan.sessionMinutes} min</div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div className="progress__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress__bar" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
