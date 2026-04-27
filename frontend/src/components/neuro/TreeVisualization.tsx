import type { NeuroTraitScores } from "../../types";

const NODES: Array<{ key: keyof NeuroTraitScores; label: string; x: number; y: number; color: string }> = [
  { key: "focus", label: "Focus", x: 50, y: 18, color: "#8fd3ff" },
  { key: "memory_retention", label: "Memory", x: 24, y: 43, color: "#24d18f" },
  { key: "distraction", label: "Distraction", x: 76, y: 43, color: "#ffcc66" },
  { key: "consistency", label: "Consistency", x: 20, y: 74, color: "#ff8fb3" },
  { key: "structure", label: "Structure", x: 50, y: 78, color: "#c7a6ff" },
  { key: "sensory_preference", label: "Sensory", x: 80, y: 74, color: "#7ce7d4" },
];

const EDGES = [
  ["focus", "memory_retention"],
  ["focus", "distraction"],
  ["memory_retention", "consistency"],
  ["memory_retention", "structure"],
  ["distraction", "structure"],
  ["distraction", "sensory_preference"],
] as Array<[keyof NeuroTraitScores, keyof NeuroTraitScores]>;

function nodeByKey(key: keyof NeuroTraitScores) {
  return NODES.find((node) => node.key === key)!;
}

export function TreeVisualization({ scores, activeTrait }: { scores: Partial<NeuroTraitScores>; activeTrait?: keyof NeuroTraitScores }) {
  return (
    <section className="neuro-tree" aria-label="Trait tree visualization">
      <div className="neuro-tree__head">
        <div>
          <div className="card__title">Trait Tree</div>
          <div className="neuro-tree__sub">Branches grow as answers shape your study setup.</div>
        </div>
      </div>
      <svg viewBox="0 0 100 100" role="img" aria-label="Focus, memory, distraction, consistency, structure and sensory trait tree">
        <defs>
          <filter id="neuroGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {EDGES.map(([fromKey, toKey]) => {
          const from = nodeByKey(fromKey);
          const to = nodeByKey(toKey);
          const intensity = Math.max(scores[fromKey] ?? 0, scores[toKey] ?? 0);
          return (
            <line
              key={`${fromKey}-${toKey}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className="neuro-tree__edge"
              style={{ strokeOpacity: 0.16 + intensity / 150, strokeWidth: 0.6 + intensity / 38 }}
            />
          );
        })}
        {NODES.map((node) => {
          const score = scores[node.key] ?? 0;
          const radius = 4.5 + score / 18;
          const active = node.key === activeTrait;
          return (
            <g key={node.key} className={active ? "neuro-tree__node neuro-tree__node--active" : "neuro-tree__node"}>
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={node.color}
                opacity={0.34 + score / 160}
                filter={active || score > 55 ? "url(#neuroGlow)" : undefined}
              />
              <circle cx={node.x} cy={node.y} r={Math.max(2.8, radius - 2.6)} fill="rgba(11,16,32,0.72)" />
              <text x={node.x} y={node.y + radius + 5.5} textAnchor="middle">
                {node.label}
              </text>
              <text x={node.x} y={node.y + 1.2} textAnchor="middle" className="neuro-tree__score">
                {score}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
