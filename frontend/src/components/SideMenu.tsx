import { useState } from "react";
import type { RouteDef, RouteKey } from "../app/state/route";

// ── Icons ─────────────────────────────────────────────────────────────────────

const ICONS: Partial<Record<RouteKey, string>> = {
  dashboard:      "⌂",
  flashcards:     "🃏",
  kanji:          "漢",
  vocab:          "語",
  grammar:        "文",
  listening:      "♪",
  reading:        "📖",
  tests:          "✎",
  jlptExam:       "🎓",
  aiExamGen:      "✦",
  grammarCheck:   "✱",
  speakingMode:   "◎",
  sentenceMining: "⛏",
  multiplayerQuiz:"⚡",
  notes:          "✏",
  sessions:       "◷",
  profile:        "◉",
  neuroAnalysis:  "◈",
  appearance:     "◐",
  imports:        "↓",
  paperUpload:    "↑",
  userManagement: "◑",
};

// ── Menu structure ────────────────────────────────────────────────────────────

type MenuGroup = {
  label: string;
  icon: string;
  keys: RouteKey[];
  managementOnly?: boolean;
};

const GROUPS: MenuGroup[] = [
  {
    label: "Dashboard",
    icon: "⌂",
    keys: ["dashboard"],
  },
  {
    label: "Study",
    icon: "✎",
    keys: ["kanji", "vocab", "grammar", "listening", "reading"],
  },
  {
    label: "Practice",
    icon: "🃏",
    keys: ["flashcards", "tests", "jlptExam"],
  },
  {
    label: "AI Tools",
    icon: "✦",
    keys: ["aiExamGen", "grammarCheck", "speakingMode", "sentenceMining"],
  },
  {
    label: "Social",
    icon: "⚡",
    keys: ["multiplayerQuiz"],
  },
  {
    label: "Notebook",
    icon: "✏",
    keys: ["notes", "sessions"],
  },
  {
    label: "Settings",
    icon: "◐",
    keys: ["profile", "neuroAnalysis", "appearance"],
  },
  {
    label: "Management",
    icon: "↓",
    keys: ["imports", "paperUpload", "userManagement"],
    managementOnly: true,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function SideMenu({
  routes,
  active,
  onNavigate,
  open,
  onClose,
}: {
  routes: RouteDef[];
  active: RouteKey;
  onNavigate: (key: RouteKey) => void;
  open: boolean;
  onClose: () => void;
}) {
  const routeMap = new Map(routes.map((r) => [r.key, r]));

  // Which section is the active route in?
  const activeGroupLabel = GROUPS.find((g) => g.keys.includes(active))?.label ?? "";

  // Sections start expanded if they contain the active route; otherwise collapsed
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of GROUPS) {
      // Dashboard is always flat (1 item), no toggle needed
      init[g.label] = g.keys.length === 1 || g.keys.includes(active);
    }
    return init;
  });

  const toggle = (label: string) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const navigate = (key: RouteKey) => {
    onNavigate(key);
    onClose();
    // Expand the section containing this route
    const grp = GROUPS.find((g) => g.keys.includes(key));
    if (grp) setExpanded((prev) => ({ ...prev, [grp.label]: true }));
  };

  return (
    <>
      <aside className={open ? "sidebar sidebar--open" : "sidebar"} aria-label="Side menu">
        {/* Brand */}
        <div className="sidebar__brand">
          <img src="/app_icon.png" alt="" className="sidebar__icon" />
          <div>
            <div className="sidebar__title">JLPT Neuro</div>
            <div className="sidebar__subtitle">N5–N1</div>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="nav" aria-label="Navigation">
          {GROUPS.map((group) => {
            // Filter to routes that exist in the allowed list
            const groupRoutes = group.keys
              .map((k) => routeMap.get(k))
              .filter((r): r is RouteDef => !!r);

            if (!groupRoutes.length) return null;

            // Single-item groups render as a flat link (no toggle)
            if (groupRoutes.length === 1) {
              const r = groupRoutes[0];
              return (
                <button
                  key={r.key}
                  className={r.key === active ? "navlink navlink--active" : "navlink"}
                  onClick={() => navigate(r.key)}
                >
                  <span className="navlink__icon">{ICONS[r.key] ?? "·"}</span>
                  <span className="navlink__label">{r.label}</span>
                </button>
              );
            }

            const isOpen = expanded[group.label] ?? false;
            const hasActive = group.keys.includes(active);

            return (
              <div key={group.label} className="nav-group">
                <button
                  className={`nav-group__header${hasActive ? " nav-group__header--active" : ""}`}
                  onClick={() => toggle(group.label)}
                  aria-expanded={isOpen}
                >
                  <span className="nav-group__icon">{group.icon}</span>
                  <span className="nav-group__label">{group.label}</span>
                  <span className="nav-group__chevron">{isOpen ? "▾" : "▸"}</span>
                </button>

                {isOpen && (
                  <div className="nav-group__items">
                    {groupRoutes.map((r) => (
                      <button
                        key={r.key}
                        className={r.key === active ? "navlink navlink--sub navlink--active" : "navlink navlink--sub"}
                        onClick={() => navigate(r.key)}
                      >
                        <span className="navlink__icon">{ICONS[r.key] ?? "·"}</span>
                        <span className="navlink__label">{r.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar__hint">
          Tip: use Quick Note anytime to capture thoughts.
        </div>
      </aside>

      {open && <button className="overlay" aria-label="Close menu" onClick={onClose} />}
    </>
  );
}
