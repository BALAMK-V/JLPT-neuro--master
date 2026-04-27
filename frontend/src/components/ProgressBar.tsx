import { useEffect, useMemo, useState } from "react";
import { getLearningStylePlan } from "../app/learningStyle";
import { useMe } from "../app/state/user";

export function ProgressBar() {
  const { me } = useMe();
  const plan = getLearningStylePlan(me?.profile);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  const { value, elapsed } = useMemo(() => {
    const elapsedMinutes = Math.floor((now - startedAt) / 60000);
    const pct = Math.min(100, Math.round((elapsedMinutes / Math.max(1, plan.sessionMinutes)) * 100));
    return { value: pct, elapsed: elapsedMinutes };
  }, [now, plan.sessionMinutes, startedAt]);

  return (
    <div className="progress">
      <div className="progress__label">
        {plan.label} session: {elapsed}/{plan.sessionMinutes} min
      </div>
      <div className="progress__track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress__bar" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
