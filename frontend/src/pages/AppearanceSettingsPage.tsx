import { useMemo, useState } from "react";
import { contrastRatio, recommendedAppearance, useAppearance } from "../app/state/appearance";
import { BackgroundUploader } from "../components/appearance/BackgroundUploader";
import { ColorPicker } from "../components/appearance/ColorPicker";
import { FontSelector } from "../components/appearance/FontSelector";
import { PreviewPanel } from "../components/appearance/PreviewPanel";
import { ThemeToggle } from "../components/appearance/ThemeToggle";
import { PageHeader } from "../components/PageHeader";
import type { AnimationLevel, LayoutDensity, StudyCompanionSettings } from "../types";

const TEXT_PRESETS = ["#f5f7fb", "#111827", "#1f2937", "#e8fff8", "#fff7d6", "#ffe7ef"];

function backgroundContrastColor(settings: ReturnType<typeof recommendedAppearance>) {
  const raw = settings.background_value || {};
  if (settings.background_type === "color") return String(raw.color || "#0b1020");
  if (settings.background_type === "gradient") return String(raw.from || "#0b1020");
  return settings.theme_mode === "light" ? "#f7fafc" : "#0b1020";
}

export function AppearanceSettingsPage() {
  const { appearance, companion, loading, setAppearancePreview, saveAppearance, resetAppearance, setCompanionPreview, saveCompanion } = useAppearance();
  const [saving, setSaving] = useState(false);
  const contrast = useMemo(() => contrastRatio(appearance.font_color, backgroundContrastColor(appearance)), [appearance]);
  const warning = contrast < 4.5 ? "Text contrast is below WCAG AA. Choose a stronger text or background color." : null;

  const updateCompanion = (next: StudyCompanionSettings) => {
    setCompanionPreview(next);
    saveCompanion(next).catch(() => null);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveAppearance(appearance);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Appearance & Personalization" subtitle="Tune comfort, readability, motion, background, and your study companion." />
      {loading ? <div className="notice">Loading appearance settings...</div> : null}

      <div className="appearance-layout">
        <div className="settings-stack">
          <section className="card" style={{ gridColumn: "span 12" }}>
            <div className="card__title">Theme mode</div>
            <ThemeToggle value={appearance.theme_mode} onChange={(theme_mode) => setAppearancePreview({ ...appearance, theme_mode })} />
          </section>

          <section className="card" style={{ gridColumn: "span 12" }}>
            <div className="card__title">Font</div>
            <FontSelector
              family={appearance.font_family}
              size={appearance.font_size}
              weight={appearance.font_weight}
              onFamily={(font_family) => setAppearancePreview({ ...appearance, font_family })}
              onSize={(font_size) => setAppearancePreview({ ...appearance, font_size })}
              onWeight={(font_weight) => setAppearancePreview({ ...appearance, font_weight })}
            />
          </section>

          <section className="card" style={{ gridColumn: "span 12" }}>
            <div className="card__title">Font color</div>
            <ColorPicker value={appearance.font_color} presets={TEXT_PRESETS} warning={warning} onChange={(font_color) => setAppearancePreview({ ...appearance, font_color })} />
          </section>

          <section className="card" style={{ gridColumn: "span 12" }}>
            <div className="card__title">Background</div>
            <BackgroundUploader settings={appearance} onChange={setAppearancePreview} />
          </section>

          <section className="card" style={{ gridColumn: "span 12" }}>
            <div className="card__title">UI style</div>
            <div className="settings-grid">
              <label className="label">
                <span className="label__text">Border radius: {appearance.border_radius}px</span>
                <input type="range" min={0} max={28} value={appearance.border_radius} onChange={(e) => setAppearancePreview({ ...appearance, border_radius: Number(e.target.value) })} />
              </label>
              <label className="label">
                <span className="label__text">Shadow: {appearance.shadow_level}</span>
                <input type="range" min={0} max={4} value={appearance.shadow_level} onChange={(e) => setAppearancePreview({ ...appearance, shadow_level: Number(e.target.value) })} />
              </label>
              <label className="label">
                <span className="label__text">Animation</span>
                <select className="field" value={appearance.animation_level} onChange={(e) => setAppearancePreview({ ...appearance, animation_level: e.target.value as AnimationLevel })}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="label">
                <span className="label__text">Layout density</span>
                <select className="field" value={appearance.layout_density} onChange={(e) => setAppearancePreview({ ...appearance, layout_density: e.target.value as LayoutDensity })}>
                  <option value="compact">Compact</option>
                  <option value="comfortable">Comfortable</option>
                  <option value="spacious">Spacious</option>
                </select>
              </label>
            </div>
          </section>

          <section className="card" style={{ gridColumn: "span 12" }}>
            <div className="card__title">Study Companion</div>
            <div className="settings-grid">
              <label className="pill" style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px" }}>
                <input type="checkbox" checked={companion.enabled} onChange={(e) => updateCompanion({ ...companion, enabled: e.target.checked })} />
                Enabled
              </label>
              <label className="pill" style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px" }}>
                <input type="checkbox" checked={companion.sound_enabled} onChange={(e) => updateCompanion({ ...companion, sound_enabled: e.target.checked })} />
                Sound
              </label>
              <label className="label">
                <span className="label__text">Character</span>
                <select className="field" value={companion.character_type} onChange={(e) => updateCompanion({ ...companion, character_type: e.target.value as StudyCompanionSettings["character_type"] })}>
                  <option value="daruma">Daruma</option>
                  <option value="maneki">Maneki</option>
                  <option value="kitsune">Kitsune</option>
                  <option value="tanuki">Tanuki</option>
                </select>
              </label>
            </div>
            <div style={{ color: "rgba(255,255,255,0.65)", marginTop: 10 }}>
              Drag the companion on screen to move it. Double-click it to trigger a celebration state.
            </div>
          </section>

          <div className="toolbar">
            <button className="btn btn--primary" disabled={saving || Boolean(warning)} onClick={save}>
              {saving ? "Saving..." : "Save appearance"}
            </button>
            <button className="btn" onClick={() => setAppearancePreview(recommendedAppearance())}>
              Recommended settings
            </button>
            <button className="btn" onClick={() => resetAppearance()}>
              Reset to default
            </button>
          </div>
        </div>

        <PreviewPanel settings={appearance} contrast={contrast} />
      </div>
    </div>
  );
}
