import { useEffect, useRef, useState } from "react";

interface Props {
  initialSeconds: number;
  onExpire: () => void;
  paused?: boolean;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimerDisplay({ initialSeconds, onExpire, paused = false }: Props) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [paused]);

  const isWarning = remaining <= 300;  // last 5 min
  const isCritical = remaining <= 60;

  return (
    <div
      className={`exam-timer ${isWarning ? "exam-timer--warning" : ""} ${isCritical ? "exam-timer--critical" : ""}`}
      aria-live="polite"
      aria-label={`Time remaining: ${formatTime(remaining)}`}
    >
      <span className="exam-timer__icon">⏱</span>
      <span className="exam-timer__value">{formatTime(remaining)}</span>
    </div>
  );
}
