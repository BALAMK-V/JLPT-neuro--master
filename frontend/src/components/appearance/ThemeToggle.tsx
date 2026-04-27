import type { ThemeMode } from "../../types";

export function ThemeToggle({ value, onChange }: { value: ThemeMode; onChange: (value: ThemeMode) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Theme mode">
      {(["light", "dark", "auto"] as ThemeMode[]).map((mode) => (
        <button key={mode} className={value === mode ? "segmented__item segmented__item--active" : "segmented__item"} onClick={() => onChange(mode)}>
          {mode[0].toUpperCase() + mode.slice(1)}
        </button>
      ))}
    </div>
  );
}
