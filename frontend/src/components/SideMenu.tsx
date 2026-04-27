import type { RouteDef, RouteKey } from "../app/state/route";

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
  return (
    <>
      <aside className={open ? "sidebar sidebar--open" : "sidebar"} aria-label="Side menu">
        <div className="sidebar__brand">
          <div className="sidebar__title">JLPT Neuro</div>
          <div className="sidebar__subtitle">JLPT N5–N1</div>
        </div>

        <nav className="nav" aria-label="Navigation">
          {routes.map((r) => (
            <button
              key={r.key}
              className={r.key === active ? "navlink navlink--active" : "navlink"}
              onClick={() => {
                onNavigate(r.key);
                onClose();
              }}
            >
              <div className="navlink__label">{r.label}</div>
              <div className="navlink__desc">{r.description}</div>
            </button>
          ))}
        </nav>

        <div className="sidebar__hint">
          Tip: use Quick Note anytime to capture thoughts and return to study.
        </div>
      </aside>

      {open ? <button className="overlay" aria-label="Close menu" onClick={onClose} /> : null}
    </>
  );
}
