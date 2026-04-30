import type { ExamHistoryEntry } from "../types";

const SECTION_COLORS: Record<string, string> = {
  vocabulary: "#7c5cff",
  grammar: "#24d18f",
  reading: "#ffcc66",
  listening: "#ff5c7a",
};
const SECTIONS = ["vocabulary", "grammar", "reading", "listening"];

interface Props {
  history: ExamHistoryEntry[];
}

export function ScoreHistoryChart({ history }: Props) {
  if (!history.length) {
    return <div className="pill" style={{ marginTop: 8 }}>No exam history yet.</div>;
  }

  const W = 560;
  const H = 160;
  const PAD_L = 36;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 32;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const n = history.length;

  const xOf = (i: number) => PAD_L + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yOf = (pct: number) => PAD_T + innerH - (pct / 100) * innerH;

  const gridLines = [0, 25, 50, 60, 75, 100];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", maxWidth: W, display: "block" }}
        aria-label="Exam score history chart"
      >
        {/* grid lines */}
        {gridLines.map((pct) => (
          <g key={pct}>
            <line
              x1={PAD_L}
              y1={yOf(pct)}
              x2={W - PAD_R}
              y2={yOf(pct)}
              stroke={pct === 60 ? "rgba(255,92,122,0.4)" : "rgba(255,255,255,0.08)"}
              strokeWidth={pct === 60 ? 1.5 : 1}
              strokeDasharray={pct === 60 ? "4 3" : undefined}
            />
            <text
              x={PAD_L - 4}
              y={yOf(pct) + 4}
              textAnchor="end"
              fontSize={9}
              fill="rgba(255,255,255,0.4)"
            >
              {pct}
            </text>
          </g>
        ))}

        {/* overall score line */}
        {history.length > 1 && (
          <polyline
            points={history.map((e, i) => `${xOf(i)},${yOf(e.score_percentage)}`).join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
        )}

        {/* per-section lines */}
        {SECTIONS.map((sec) => {
          const color = SECTION_COLORS[sec] ?? "#fff";
          const pts = history
            .map((e, i) => {
              const pct = e.section_scores?.[sec]?.percentage ?? null;
              return pct !== null ? `${xOf(i)},${yOf(pct)}` : null;
            })
            .filter(Boolean)
            .join(" ");
          if (!pts) return null;
          return (
            <polyline
              key={sec}
              points={pts}
              fill="none"
              stroke={color}
              strokeWidth={2}
              opacity={0.85}
            />
          );
        })}

        {/* dots + labels for overall score */}
        {history.map((e, i) => (
          <g key={e.id}>
            <circle
              cx={xOf(i)}
              cy={yOf(e.score_percentage)}
              r={4}
              fill={e.passed ? "#24d18f" : "#ff5c7a"}
            />
            <title>{`${e.exam_title}: ${e.score_percentage.toFixed(1)}%`}</title>
            {/* x-axis label */}
            <text
              x={xOf(i)}
              y={H - 4}
              textAnchor="middle"
              fontSize={8}
              fill="rgba(255,255,255,0.45)"
            >
              {new Date(e.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </text>
          </g>
        ))}
      </svg>

      {/* legend */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 14, height: 2, background: "rgba(255,255,255,0.55)", verticalAlign: "middle" }} />
          Overall
        </span>
        {SECTIONS.map((sec) => (
          <span
            key={sec}
            style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", gap: 4 }}
          >
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 2,
                background: SECTION_COLORS[sec],
                verticalAlign: "middle",
              }}
            />
            {sec}
          </span>
        ))}
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
          — red dashed = 60% pass line
        </span>
      </div>
    </div>
  );
}
