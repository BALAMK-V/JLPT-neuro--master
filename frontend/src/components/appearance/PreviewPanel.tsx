import type { AppearanceSettings } from "../../types";

export function PreviewPanel({ settings, contrast }: { settings: AppearanceSettings; contrast: number }) {
  return (
    <div className="appearance-preview">
      <div className="appearance-preview__toolbar">
        <span className="pill">Live preview</span>
        <span className={contrast >= 4.5 ? "pill" : "pill pill--warn"}>Contrast {contrast.toFixed(1)}:1</span>
      </div>
      <div className="appearance-preview__card">
        <div className="card__title">今日の学習</div>
        <p>Vocabulary, kanji, listening, and reading surfaces will inherit these settings instantly.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn--primary">Start</button>
          <button className="btn">Review</button>
          <span className="pill">{settings.layout_density}</span>
        </div>
      </div>
    </div>
  );
}
