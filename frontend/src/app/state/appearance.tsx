import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { AppearanceSettings, StudyCompanionSettings } from "../../types";

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme_mode: "dark",
  font_family: "sans",
  font_size: "medium",
  font_weight: "normal",
  font_color: "#f5f7fb",
  background_type: "gradient",
  background_value: { from: "#0b1020", to: "#11263f", angle: 180 },
  blur_level: 0,
  opacity: 1,
  border_radius: 14,
  shadow_level: 2,
  animation_level: "normal",
  layout_density: "comfortable",
};

export const DEFAULT_COMPANION: StudyCompanionSettings = {
  character_type: "daruma",
  enabled: true,
  position: { x: 24, y: 24, corner: "bottom-right" },
  sound_enabled: false,
};

type AppearanceState = {
  appearance: AppearanceSettings;
  companion: StudyCompanionSettings;
  loading: boolean;
  setAppearancePreview: (next: AppearanceSettings) => void;
  saveAppearance: (next: AppearanceSettings) => Promise<void>;
  resetAppearance: () => Promise<void>;
  setCompanionPreview: (next: StudyCompanionSettings) => void;
  saveCompanion: (next: StudyCompanionSettings) => Promise<void>;
};

const Ctx = createContext<AppearanceState | null>(null);

function fontFamilyValue(value: AppearanceSettings["font_family"]) {
  if (value === "serif") return "Georgia, Cambria, 'Times New Roman', serif";
  if (value === "rounded") return "'Segoe UI Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif";
  if (value === "mono") return "'Cascadia Code', Consolas, 'SFMono-Regular', monospace";
  return "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
}

function fontSizeValue(value: AppearanceSettings["font_size"]) {
  if (value === "small") return "14px";
  if (value === "large") return "18px";
  return "16px";
}

function fontWeightValue(value: AppearanceSettings["font_weight"]) {
  if (value === "light") return "350";
  if (value === "bold") return "700";
  return "450";
}

function shadowValue(level: number) {
  if (level <= 0) return "none";
  if (level === 1) return "0 8px 24px rgba(0,0,0,0.22)";
  if (level === 3) return "0 22px 60px rgba(0,0,0,0.42)";
  if (level >= 4) return "0 30px 90px rgba(0,0,0,0.52)";
  return "0 18px 48px rgba(0,0,0,0.35)";
}

function backgroundValue(s: AppearanceSettings) {
  const raw = s.background_value || {};
  if (s.background_type === "color") return String(raw.color || "#0b1020");
  if (s.background_type === "image") {
    const url = String(raw.url || "");
    const fit = String(raw.fit || "cover");
    return url ? `linear-gradient(rgba(8,10,20,${1 - s.opacity}), rgba(8,10,20,${1 - s.opacity})), url("${url}") center / ${fit} no-repeat fixed` : "#0b1020";
  }
  const from = String(raw.from || "#0b1020");
  const to = String(raw.to || "#11263f");
  const angle = Number(raw.angle ?? 180);
  return `linear-gradient(${angle}deg, ${from}, ${to})`;
}

export function luminance(hex: string) {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return 0;
  const rgb = [0, 2, 4].map((idx) => parseInt(clean.slice(idx, idx + 2), 16) / 255);
  const linear = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(a: string, b: string) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function recommendedAppearance(): AppearanceSettings {
  return {
    ...DEFAULT_APPEARANCE,
    font_family: "sans",
    font_size: "medium",
    font_weight: "normal",
    font_color: "#f5f7fb",
    border_radius: 10,
    shadow_level: 1,
    animation_level: "low",
    layout_density: "comfortable",
  };
}

function lightBackgroundValue(s: AppearanceSettings) {
  const raw = s.background_value || {};
  if (s.background_type === "image") return backgroundValue(s);
  const angle = Number((raw as Record<string, unknown>).angle ?? 180);
  return `linear-gradient(${angle}deg, #eef1fa 0%, #e4e8f5 100%)`;
}

function applyAppearance(s: AppearanceSettings) {
  const root = document.documentElement;
  const mode =
    s.theme_mode === "auto"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : s.theme_mode;

  root.dataset.themeMode = mode;
  root.dataset.density = s.layout_density;
  root.dataset.animationLevel = s.animation_level;

  // Sentinel is a self-contained theme — its CSS vars are fully defined in
  // global.css and should not be overridden by user customisation settings.
  // We only allow font-size passthrough so accessibility preferences still apply.
  if (mode === "sentinel") {
    root.style.setProperty("--app-font-size", fontSizeValue(s.font_size));
    // Remove any inline overrides left from a previous theme so the CSS block wins.
    for (const prop of [
      "--font", "--app-font-weight", "--text", "--radius",
      "--shadow", "--app-bg", "--bg-blur",
    ]) {
      root.style.removeProperty(prop);
    }
    return;
  }

  root.style.setProperty("--font", fontFamilyValue(s.font_family));
  root.style.setProperty("--app-font-size", fontSizeValue(s.font_size));
  root.style.setProperty("--app-font-weight", fontWeightValue(s.font_weight));
  root.style.setProperty("--text", mode === "light" ? "rgba(15,17,26,0.9)" : s.font_color);
  root.style.setProperty("--radius", `${s.border_radius}px`);
  root.style.setProperty("--shadow", mode === "light" ? "0 4px 20px rgba(15,17,26,0.08)" : shadowValue(s.shadow_level));
  root.style.setProperty("--app-bg", mode === "light" ? lightBackgroundValue(s) : backgroundValue(s));
  root.style.setProperty("--bg-blur", `${s.blur_level}px`);
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [companion, setCompanion] = useState<StudyCompanionSettings>(DEFAULT_COMPANION);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [appearanceData, companionData] = await Promise.all([
          api<AppearanceSettings>("/appearance/").catch(() => DEFAULT_APPEARANCE),
          api<StudyCompanionSettings>("/companion/").catch(() => DEFAULT_COMPANION),
        ]);
        if (!mounted) return;
        setAppearance({ ...DEFAULT_APPEARANCE, ...appearanceData });
        setCompanion({ ...DEFAULT_COMPANION, ...companionData });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => applyAppearance(appearance), [appearance]);

  const value = useMemo<AppearanceState>(
    () => ({
      appearance,
      companion,
      loading,
      setAppearancePreview: setAppearance,
      saveAppearance: async (next) => {
        setAppearance(next);
        const saved = await api<AppearanceSettings>("/appearance/update/", "POST", next);
        setAppearance({ ...DEFAULT_APPEARANCE, ...saved });
      },
      resetAppearance: async () => {
        const reset = await api<AppearanceSettings>("/appearance/reset/", "POST");
        setAppearance({ ...DEFAULT_APPEARANCE, ...reset });
      },
      setCompanionPreview: setCompanion,
      saveCompanion: async (next) => {
        setCompanion(next);
        const saved = await api<StudyCompanionSettings>("/companion/update/", "POST", next);
        setCompanion({ ...DEFAULT_COMPANION, ...saved });
      },
    }),
    [appearance, companion, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppearance() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppearance must be used within AppearanceProvider");
  return v;
}
