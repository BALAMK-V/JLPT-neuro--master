import { useState } from "react";
import type { AvatarConfig } from "../../types";
import { PlayerAvatar } from "./PlayerAvatar";
import { api } from "../../app/api/client";

const SKIN_TONES = [
  "#f5d0b0", "#e8b89a", "#d4956a", "#c07840", "#a05c28",
  "#7a3e14", "#4a230a", "#ffe4d6",
];

const HAIR_STYLES: AvatarConfig["hair_style"][] = ["short", "long", "spiky", "bald", "ponytail"];
const EYE_SHAPES: AvatarConfig["eye_shape"][] = ["round", "almond", "narrow"];
const ACCESSORIES: AvatarConfig["accessory"][] = ["none", "glasses", "hat", "headband"];

interface AvatarBuilderProps {
  initial?: Partial<AvatarConfig>;
  onSave?: (config: AvatarConfig) => void;
}

const DEFAULT: AvatarConfig = {
  skin_tone: "#f5d0b0",
  hair_style: "short",
  hair_color: "#2c2c2c",
  eye_shape: "round",
  eye_color: "#4a7c59",
  accessory: "none",
};

export function AvatarBuilder({ initial, onSave }: AvatarBuilderProps) {
  const [cfg, setCfg] = useState<AvatarConfig>({ ...DEFAULT, ...initial });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<AvatarConfig>) => {
    setCfg((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api("/auth/me/", "PATCH", { profile: { avatar_config: cfg } });
      setSaved(true);
      onSave?.(cfg);
    } catch {
      // silently fail — user can retry
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      {/* Preview */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <PlayerAvatar config={cfg} size={96} />
        <button
          className="btn btn--primary"
          onClick={handleSave}
          disabled={saving}
          style={{ minWidth: 100 }}
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </div>

      {/* Controls */}
      <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Skin tone */}
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
            Skin Tone
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SKIN_TONES.map((c) => (
              <button
                key={c}
                onClick={() => update({ skin_tone: c })}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: c,
                  border: cfg.skin_tone === c ? "2px solid var(--accent)" : "2px solid transparent",
                  cursor: "pointer",
                  padding: 0,
                }}
                title={c}
              />
            ))}
            <input
              type="color"
              value={cfg.skin_tone}
              onChange={(e) => update({ skin_tone: e.target.value })}
              style={{ width: 26, height: 26, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0 }}
              title="Custom skin tone"
            />
          </div>
        </div>

        {/* Hair style */}
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
            Hair Style
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {HAIR_STYLES.map((s) => (
              <button
                key={s}
                onClick={() => update({ hair_style: s })}
                className={cfg.hair_style === s ? "btn btn--primary" : "btn"}
                style={{ fontSize: 11, padding: "3px 8px" }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Hair color */}
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
            Hair Color
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {["#2c2c2c", "#8b4513", "#d4a017", "#ff6b35", "#4a9eff", "#cc44cc", "#e8e8e8", "#ffffff"].map((c) => (
              <button
                key={c}
                onClick={() => update({ hair_color: c })}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: c,
                  border: cfg.hair_color === c ? "2px solid var(--accent)" : "2px solid var(--border)",
                  cursor: "pointer",
                  padding: 0,
                }}
                title={c}
              />
            ))}
            <input
              type="color"
              value={cfg.hair_color}
              onChange={(e) => update({ hair_color: e.target.value })}
              style={{ width: 22, height: 22, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0 }}
            />
          </div>
        </div>

        {/* Eye shape */}
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
            Eye Shape
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {EYE_SHAPES.map((s) => (
              <button
                key={s}
                onClick={() => update({ eye_shape: s })}
                className={cfg.eye_shape === s ? "btn btn--primary" : "btn"}
                style={{ fontSize: 11, padding: "3px 8px" }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Eye color */}
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
            Eye Color
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {["#4a7c59", "#2c6cb0", "#8b4513", "#6b2d8b", "#1a1a1a", "#2d8b7c"].map((c) => (
              <button
                key={c}
                onClick={() => update({ eye_color: c })}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: c,
                  border: cfg.eye_color === c ? "2px solid var(--accent)" : "2px solid var(--border)",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
            <input
              type="color"
              value={cfg.eye_color}
              onChange={(e) => update({ eye_color: e.target.value })}
              style={{ width: 22, height: 22, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0 }}
            />
          </div>
        </div>

        {/* Accessory */}
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
            Accessory
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {ACCESSORIES.map((a) => (
              <button
                key={a}
                onClick={() => update({ accessory: a })}
                className={cfg.accessory === a ? "btn btn--primary" : "btn"}
                style={{ fontSize: 11, padding: "3px 8px" }}
              >
                {a === "none" ? "none" : a}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
