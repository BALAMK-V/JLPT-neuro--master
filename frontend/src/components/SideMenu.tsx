import { useState } from "react";
import type { RouteDef, RouteKey } from "../app/state/route";
import { useMe } from "../app/state/user";
import { useAppearance } from "../app/state/appearance";

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
  const { me } = useMe();
  const { appearance, saveAppearance } = useAppearance();
  const routeMap = new Map(routes.map((r) => [r.key, r]));

  const activeGroupLabel = GROUPS.find((g) => g.keys.includes(active))?.label ?? "";

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of GROUPS) {
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
    const grp = GROUPS.find((g) => g.keys.includes(key));
    if (grp) setExpanded((prev) => ({ ...prev, [grp.label]: true }));
  };

  const toggleTheme = () => {
    const next = appearance.theme_mode === "dark" ? "light" : "dark";
    saveAppearance({ ...appearance, theme_mode: next });
  };

  const isDark = appearance.theme_mode !== "light";

  const initials = me
    ? (me.first_name && me.last_name
        ? `${me.first_name[0]}${me.last_name[0]}`.toUpperCase()
        : me.username.slice(0, 2).toUpperCase())
    : "??";

  const displayName = me
    ? ([me.first_name, me.last_name].filter(Boolean).join(" ") || me.username)
    : "";

  // suppress the activeGroupLabel warning
  void activeGroupLabel;

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

        {/* User card */}
        {me && (
          <button className="sidebar__user" onClick={() => navigate("profile")}>
            <div className="sidebar__avatar">{initials}</div>
            <div className="sidebar__user-info">
              <div className="sidebar__user-name">{displayName}</div>
              <div className="sidebar__user-meta">
                <span className="pill pill--sm">{me.profile.jlpt_level}</span>
                {me.is_staff && <span className="pill pill--sm pill--management">Staff</span>}
              </div>
            </div>
          </button>
        )}

        {/* Nav groups */}
        <nav className="nav" aria-label="Navigation">
          {GROUPS.map((group) => {
            const groupRoutes = group.keys
              .map((k) => routeMap.get(k))
              .filter((r): r is RouteDef => !!r);

            if (!groupRoutes.length) return null;

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

        {/* Footer: theme toggle + hint */}
        <div className="sidebar__footer">
          <button
            className="sidebar__theme-toggle"
            onClick={toggleTheme}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span>{isDark ? "☀" : "◑"}</span>
            <span>{isDark ? "Light mode" : "Dark mode"}</span>
          </button>
          <div className="sidebar__hint">
            Tip: use Quick Note anytime to capture thoughts.
          </div>
        </div>
      </aside>

      {open && <button className="overlay" aria-label="Close menu" onClick={onClose} />}
    </>
  );
}
