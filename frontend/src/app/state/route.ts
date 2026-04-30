import { useEffect, useMemo, useState } from "react";

export type RouteKey =
  | "dashboard"
  | "imports"
  | "kanji"
  | "vocab"
  | "listening"
  | "reading"
  | "grammar"
  | "flashcards"
  | "tests"
  | "jlptExam"
  | "paperUpload"
  | "notes"
  | "sessions"
  | "appearance"
  | "profile"
  | "neuroAnalysis";

export type RouteDef = {
  key: RouteKey;
  label: string;
  description: string;
};

export const ROUTES: RouteDef[] = [
  { key: "dashboard", label: "Dashboard", description: "Overview, streak, due reviews" },
  { key: "imports", label: "Imports", description: "CSV/ZIP validate + preview + upload" },
  { key: "flashcards", label: "Flashcards", description: "Decks + review (Again/Hard/Good/Easy)" },
  { key: "kanji", label: "Kanji", description: "Learn + review kanji" },
  { key: "vocab", label: "Vocabulary", description: "Learn + review words" },
  { key: "listening", label: "Listening", description: "Audio + MCQ practice" },
  { key: "reading", label: "Reading", description: "Reading comprehension patterns" },
  { key: "grammar", label: "Grammar", description: "Grammar patterns + drills" },
  { key: "tests", label: "Tests", description: "JLPT-style quizzes + mocks" },
  { key: "jlptExam", label: "JLPT Exam", description: "Full official-style exam simulation N5–N1" },
  { key: "paperUpload", label: "Upload Paper", description: "Scan & OCR a question paper to import questions" },
  { key: "notes", label: "Notes", description: "Quick, context, session notes" },
  { key: "sessions", label: "Sessions", description: "Goals, progress, summaries" },
  { key: "appearance", label: "Appearance & Personalization", description: "Theme, layout, companion" },
  { key: "neuroAnalysis", label: "Learning Style Check", description: "Personalized study rhythm and screen comfort" },
  { key: "profile", label: "Profile", description: "Learning type, preferences" },
];

function parseHash(): RouteKey {
  if (window.location.pathname === "/neuro-analysis") return "neuroAnalysis";
  if (window.location.pathname === "/settings/appearance") return "appearance";
  const raw = window.location.hash.replace("#", "").trim();
  if (raw === "neuro-analysis") return "neuroAnalysis";
  const keys = new Set(ROUTES.map((r) => r.key));
  return keys.has(raw as RouteKey) ? (raw as RouteKey) : "dashboard";
}

export function setRoute(key: RouteKey) {
  if (key === "neuroAnalysis") {
    window.history.pushState(null, "", "/neuro-analysis");
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }
  if (key === "appearance") {
    window.history.pushState(null, "", "/settings/appearance");
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }
  if (window.location.pathname === "/neuro-analysis" || window.location.pathname === "/settings/appearance") {
    window.history.pushState(null, "", "/");
  }
  window.location.hash = `#${key}`;
}

export function useRoute() {
  const [route, setRouteState] = useState<RouteKey>(() => parseHash());

  useEffect(() => {
    const onHash = () => setRouteState(parseHash());
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onHash);
    };
  }, []);

  const def = useMemo(() => ROUTES.find((r) => r.key === route)!, [route]);
  return { route, def };
}
