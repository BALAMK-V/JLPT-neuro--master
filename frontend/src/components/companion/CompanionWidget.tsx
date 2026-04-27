import { useEffect, useMemo, useRef, useState } from "react";
import { useAppearance } from "../../app/state/appearance";
import type { StudyCompanionSettings } from "../../types";

type Mood = "idle" | "studying" | "excited" | "nudging" | "cheering";

const FACE: Record<StudyCompanionSettings["character_type"], string> = {
  daruma: "達",
  maneki: "招",
  kitsune: "狐",
  tanuki: "狸",
};

function moodText(mood: Mood) {
  if (mood === "studying") return "Good focus";
  if (mood === "excited") return "Nice finish";
  if (mood === "nudging") return "Ready?";
  if (mood === "cheering") return "Keep going";
  return "Resting";
}

function playSoftTone(enabled: boolean) {
  if (!enabled) return;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  const ctx = new AudioContextClass();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 620;
  gain.gain.value = 0.025;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
}

export function CompanionWidget() {
  const { companion, saveCompanion, setCompanionPreview } = useAppearance();
  const [mood, setMood] = useState<Mood>("idle");
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const pos = useMemo(() => ({ x: companion.position.x ?? 24, y: companion.position.y ?? 24 }), [companion.position]);

  useEffect(() => {
    if (!companion.enabled) return;
    const onActivity = () => {
      setMood("studying");
      window.clearTimeout((onActivity as any).timer);
      (onActivity as any).timer = window.setTimeout(() => setMood("idle"), 4000);
    };
    const inactive = window.setInterval(() => setMood((value) => (value === "idle" ? "nudging" : value)), 90_000);
    const cheer = window.setInterval(() => setMood("cheering"), 20 * 60_000);
    window.addEventListener("click", onActivity);
    window.addEventListener("keydown", onActivity);
    return () => {
      window.removeEventListener("click", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.clearInterval(inactive);
      window.clearInterval(cheer);
      window.clearTimeout((onActivity as any).timer);
    };
  }, [companion.enabled]);

  if (!companion.enabled) return null;

  const updatePosition = (clientX: number, clientY: number, persist = false) => {
    const next = {
      ...companion,
      position: {
        x: Math.max(8, window.innerWidth - clientX - dragOffset.current.x),
        y: Math.max(8, window.innerHeight - clientY - dragOffset.current.y),
        corner: "bottom-right",
      },
    };
    setCompanionPreview(next);
    if (persist) saveCompanion(next).catch(() => null);
  };

  return (
    <button
      className={`companion companion--${companion.character_type} companion--${mood}`}
      style={{ right: pos.x, bottom: pos.y }}
      aria-label={`Study companion: ${moodText(mood)}`}
      onDoubleClick={() => {
        setMood("excited");
        playSoftTone(companion.sound_enabled);
        window.setTimeout(() => setMood("idle"), 2500);
      }}
      onPointerDown={(e) => {
        setDragging(true);
        const rect = e.currentTarget.getBoundingClientRect();
        dragOffset.current = { x: window.innerWidth - rect.right + (e.clientX - rect.left), y: window.innerHeight - rect.bottom + (e.clientY - rect.top) };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (dragging) updatePosition(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        setDragging(false);
        updatePosition(e.clientX, e.clientY, true);
      }}
    >
      <span className="companion__face">{FACE[companion.character_type]}</span>
      <span className="companion__bubble">{moodText(mood)}</span>
    </button>
  );
}
