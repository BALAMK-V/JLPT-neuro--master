import type { ThemeMode } from "../../types";

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: string; description: string }[] = [
  { mode: "light",    icon: "☀",  label: "Light",    description: "Clean white background" },
  { mode: "dark",     icon: "◑",  label: "Dark",     description: "Default dark mode" },
  { mode: "auto",     icon: "⬡",  label: "Auto",     description: "Follows system preference" },
  { mode: "sentinel", icon: "◈",  label: "Sentinel", description: "Black & crimson ops theme" },
];

export function ThemeToggle({ value, onChange }: { value: ThemeMode; onChange: (value: ThemeMode) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="segmented" role="group" aria-label="Theme mode">
        {THEME_OPTIONS.map(({ mode, icon, label }) => (
          <button
            key={mode}
            className={value === mode ? "segmented__item segmented__item--active" : "segmented__item"}
            onClick={() => onChange(mode)}
            title={label}
            style={mode === "sentinel" && value === mode ? {
              background: "#cc1a1a",
              borderColor: "#cc1a1a",
              color: "#fff",
              fontWeight: 700,
              letterSpacing: "0.06em",
            } : mode === "sentinel" ? {
              borderColor: "rgba(200,20,20,0.35)",
              color: "#cc1a1a",
            } : undefined}
          >
            <span style={{ marginRight: 5 }}>{icon}</span>{label}
          </button>
        ))}
      </div>

      {/* Description of selected theme */}
      <div style={{ fontSize: 12, color: "var(--text-muted)", paddingLeft: 2 }}>
        {THEME_OPTIONS.find((o) => o.mode === value)?.description}
        {value === "sentinel" && (
          <span style={{
            marginLeft: 8,
            padding: "1px 6px",
            background: "rgba(200,20,20,0.15)",
            border: "1px solid rgba(200,20,20,0.4)",
            borderRadius: 2,
            color: "#cc1a1a",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}>
            ◈ SENTINEL
          </span>
        )}
      </div>
    </div>
  );
}
