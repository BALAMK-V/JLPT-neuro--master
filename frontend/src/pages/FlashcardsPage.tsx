import { useEffect, useRef, useState } from "react";
import { api } from "../app/api/client";
import { getLearningStylePlan } from "../app/learningStyle";
import { useMe } from "../app/state/user";
import { PageHeader } from "../components/PageHeader";
import type { FlashCard, FlashDeck, Paginated } from "../types";

// ── Deck detail component ─────────────────────────────────────────────────────

function DeckDetail({
  deck,
  cards,
  busy,
  front,
  back,
  setFront,
  setBack,
  onAdd,
  onDelete,
  onStartReview,
  isManagement,
}: {
  deck: FlashDeck;
  cards: FlashCard[];
  busy: boolean;
  front: string;
  back: string;
  setFront: (v: string) => void;
  setBack: (v: string) => void;
  onAdd: () => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onStartReview: () => void;
  isManagement: boolean;
}) {
  const now = Date.now();
  const dueCards = cards.filter((c) => !c.suspended && new Date(c.due_at).getTime() <= now);
  const newCards = cards.filter((c) => c.repetitions === 0 && !c.suspended);
  const learnCards = cards.filter((c) => c.repetitions > 0 && c.interval_days < 7 && !c.suspended);
  const reviewCards = cards.filter((c) => c.interval_days >= 7 && !c.suspended);

  return (
    <div>
      {/* Deck header */}
      <div className="fc-deck-header">
        <div className="fc-deck-header__info">
          <div className="fc-deck-header__name">
            {deck.name}
            {deck.is_locked && <span className="pill" style={{ marginLeft: 10, fontSize: 11 }}>system</span>}
          </div>
          <div className="fc-deck-header__badges">
            <span className={`level-badge level-badge--${deck.jlpt_level.toLowerCase()}`}>{deck.jlpt_level}</span>
            <span className="type-badge">{deck.deck_type}</span>
            <span className="pill">{deck.srs_algo?.toUpperCase() ?? "SM2"}</span>
          </div>
        </div>
        {deck.due_count > 0 && (
          <button className="btn btn--primary fc-deck-header__study" onClick={onStartReview}>
            Study Now →
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="fc-stats-row">
        <div className="fc-stat">
          <div className="fc-stat__num">{deck.total_cards}</div>
          <div className="fc-stat__lbl">Total</div>
        </div>
        <div className="fc-stat fc-stat--due">
          <div className="fc-stat__num">{deck.due_count}</div>
          <div className="fc-stat__lbl">Due</div>
        </div>
        <div className="fc-stat">
          <div className="fc-stat__num">{newCards.length}</div>
          <div className="fc-stat__lbl">New</div>
        </div>
        <div className="fc-stat">
          <div className="fc-stat__num">{learnCards.length}</div>
          <div className="fc-stat__lbl">Learning</div>
        </div>
        <div className="fc-stat">
          <div className="fc-stat__num">{reviewCards.length}</div>
          <div className="fc-stat__lbl">Review</div>
        </div>
        <div className="fc-stat">
          <div className="fc-stat__num">{cards.filter((c) => c.suspended).length}</div>
          <div className="fc-stat__lbl">Suspended</div>
        </div>
      </div>

      {deck.due_count === 0 && (
        <div className="notice notice--ok" style={{ marginBottom: 12 }}>
          All caught up — no cards due right now.
        </div>
      )}

      {deck.is_locked && (
        <div className="notice" style={{ marginBottom: 12 }}>
          System deck — cards are auto-generated from {deck.jlpt_level} content.
        </div>
      )}

      {/* Add card (management + unlocked decks only) */}
      {isManagement && !deck.is_locked && (
        <div className="fc-add-section">
          <div className="fc-section-title">Add Card</div>
          <div className="fc-add-row">
            <textarea
              className="field fc-add-field"
              placeholder="Front — question / character"
              value={front}
              rows={3}
              onChange={(e) => setFront(e.target.value)}
            />
            <textarea
              className="field fc-add-field"
              placeholder="Back — answer / meaning"
              value={back}
              rows={3}
              onChange={(e) => setBack(e.target.value)}
            />
            <button
              className="btn btn--primary"
              style={{ alignSelf: "flex-end" }}
              disabled={busy || !front.trim() || !back.trim()}
              onClick={() => onAdd()}
            >
              Add Card
            </button>
          </div>
        </div>
      )}

      {/* Card list */}
      <div style={{ marginTop: 16 }}>
        <div className="fc-section-title">Cards ({cards.length})</div>
        {!cards.length ? (
          <div className="fc-empty" style={{ padding: "32px 20px" }}>
            <div className="fc-empty__icon" style={{ fontSize: 36 }}>📭</div>
            <div className="fc-empty__sub">No cards yet. Add one above or import via the Imports page.</div>
          </div>
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Front</th>
                  <th>Back</th>
                  <th style={{ width: 80 }}>Due</th>
                  <th style={{ width: 70 }}>Intv.</th>
                  <th style={{ width: 60 }}>EF</th>
                  <th style={{ width: 60 }}>Reps</th>
                  {isManagement && !deck.is_locked ? <th style={{ width: 80 }} /> : null}
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => {
                  const overdue = !c.suspended && new Date(c.due_at).getTime() <= Date.now();
                  return (
                    <tr key={c.id} style={c.suspended ? { opacity: 0.45 } : undefined}>
                      <td style={{ fontWeight: 600 }}>{c.front}</td>
                      <td className="ui-caption" style={{ whiteSpace: "pre-wrap", maxWidth: 220 }}>{c.back}</td>
                      <td className="ui-meta" style={{ fontSize: 12, color: overdue ? "var(--bad)" : undefined }}>
                        {c.suspended ? "suspended" : new Date(c.due_at).toLocaleDateString()}
                      </td>
                      <td className="ui-meta" style={{ fontSize: 12 }}>{c.interval_days}d</td>
                      <td className="ui-meta" style={{ fontSize: 12 }}>{c.ease_factor.toFixed(1)}</td>
                      <td className="ui-meta" style={{ fontSize: 12 }}>{c.repetitions}</td>
                      {isManagement && !deck.is_locked ? (
                        <td>
                          <button className="btn" style={{ fontSize: 11, padding: "4px 8px" }} disabled={busy} onClick={() => onDelete(c.id)}>
                            Remove
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Review (Anki-style flip card) ─────────────────────────────────────────────

function ReviewView({
  deckId,
  deckName,
  limit,
  onDone,
}: {
  deckId: number;
  deckName: string;
  limit: number;
  onDone: () => void;
}) {
  const [queue, setQueue] = useState<FlashCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionDone, setSessionDone] = useState(0);

  const current = queue[idx] ?? null;
  const showBackRef = useRef(false);
  const busyRef = useRef(false);
  showBackRef.current = flipped;
  busyRef.current = busy;

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ count: number; results: FlashCard[] }>(
        `/flash/next/?deck_id=${deckId}&limit=${limit}`
      );
      setQueue(res.results);
      setIdx(0);
      setFlipped(false);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, [deckId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rate = async (rating: "again" | "hard" | "good" | "easy") => {
    if (!current || busyRef.current) return;
    setBusy(true);
    setError(null);
    try {
      await api<FlashCard>("/flash/review/", "POST", { card_id: current.id, rating });
      setSessionDone((s) => s + 1);
      const nextIdx = idx + 1;
      if (nextIdx >= queue.length) {
        await load();
      } else {
        setIdx(nextIdx);
        setFlipped(false);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const rateRef = useRef<typeof rate>(rate);
  rateRef.current = rate;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === " " || e.key === "Enter") && !showBackRef.current) { e.preventDefault(); setFlipped(true); return; }
      if (showBackRef.current && !busyRef.current) {
        if (e.key === "1") void rateRef.current("again");
        if (e.key === "2") void rateRef.current("hard");
        if (e.key === "3") { e.preventDefault(); void rateRef.current("good"); }
        if (e.key === "4") void rateRef.current("easy");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = queue.length - idx;
  const total = sessionDone + remaining;
  const progressPct = total > 0 ? Math.round((sessionDone / total) * 100) : 0;

  if (!busy && !current) {
    return (
      <div className="fc-review fc-review--done">
        <div className="fc-done-icon">✓</div>
        <div className="fc-done-title">Session complete!</div>
        <div className="fc-done-sub">
          {sessionDone > 0
            ? `You reviewed ${sessionDone} card${sessionDone !== 1 ? "s" : ""} this session.`
            : "No cards due right now."}
        </div>
        <button className="btn btn--primary" onClick={onDone}>Back to Decks</button>
      </div>
    );
  }

  return (
    <div className="fc-review">
      {/* Top bar */}
      <div className="fc-review__topbar">
        <button className="btn" onClick={onDone}>← {deckName}</button>
        <div className="fc-review__progress">
          <div className="fc-review__progress-track">
            <div className="fc-review__progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="fc-review__progress-label">{sessionDone} done · {remaining} left</span>
        </div>
        <button className="btn" disabled={busy} onClick={load} title="Reload queue">↺</button>
      </div>

      {error && <div className="notice notice--bad" style={{ maxWidth: 620, margin: "0 auto 16px" }}>{error}</div>}

      {/* The card */}
      <div className="fc-anki-wrap">
        <div
          className={`fc-anki-card${flipped ? " fc-anki-card--flipped" : ""}`}
          onClick={() => !flipped && setFlipped(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!flipped) setFlipped(true); } }}
        >
          <div className="fc-anki-inner">
            {/* Front face */}
            <div className="fc-anki-front">
              <div className="fc-anki-front__content">
                {busy && !current ? (
                  <span className="ui-meta">Loading…</span>
                ) : current ? (
                  <>
                    <div className="fc-anki-front__text">{current.front}</div>
                    <div className="fc-anki-hint">Press Space / tap to reveal</div>
                  </>
                ) : null}
              </div>
              <div className="fc-anki-card__meta">
                {current ? (
                  <>
                    {current.interval_days > 0 ? `${current.interval_days}d` : "new"}
                    {" · "}EF {current.ease_factor.toFixed(2)}
                    {current.tags?.length ? ` · ${current.tags.join(", ")}` : ""}
                  </>
                ) : null}
              </div>
            </div>

            {/* Back face (shown when flipped) */}
            <div className="fc-anki-back">
              <div className="fc-anki-back__content">
                <div className="fc-anki-back__front-echo">{current?.front}</div>
                <div className="fc-anki-divider" />
                <div className="fc-anki-back__text">{current?.back}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rating buttons */}
      {current && flipped ? (
        <div className="fc-ratings">
          <button className="fc-rating fc-rating--again" disabled={busy} onClick={() => void rate("again")}>
            <span className="fc-rating__label">Again</span>
            <span className="fc-rating__sub">&lt;10min</span>
            <kbd>1</kbd>
          </button>
          <button className="fc-rating fc-rating--hard" disabled={busy} onClick={() => void rate("hard")}>
            <span className="fc-rating__label">Hard</span>
            <span className="fc-rating__sub">shorter</span>
            <kbd>2</kbd>
          </button>
          <button className="fc-rating fc-rating--good" disabled={busy} onClick={() => void rate("good")}>
            <span className="fc-rating__label">Good</span>
            <span className="fc-rating__sub">normal</span>
            <kbd>3</kbd>
          </button>
          <button className="fc-rating fc-rating--easy" disabled={busy} onClick={() => void rate("easy")}>
            <span className="fc-rating__label">Easy</span>
            <span className="fc-rating__sub">longer</span>
            <kbd>4</kbd>
          </button>
        </div>
      ) : current && !flipped ? (
        <button className="btn btn--primary fc-show-btn" onClick={() => setFlipped(true)}>
          Show Answer <span className="fc-kbd">Space</span>
        </button>
      ) : null}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function FlashcardsPage() {
  const { me } = useMe();
  const plan = getLearningStylePlan(me?.profile);

  const [decks, setDecks] = useState<FlashDeck[]>([]);
  const [deckId, setDeckId] = useState<number | null>(null);
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [mode, setMode] = useState<"manage" | "review">("manage");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leechCount, setLeechCount] = useState(0);
  const [showLeeches, setShowLeeches] = useState(false);
  const [leeches, setLeeches] = useState<FlashCard[]>([]);

  const selected = decks.find((d) => d.id === deckId) ?? null;

  const loadDecks = async () => {
    const data = await api<Paginated<FlashDeck>>("/flash/decks/?ordering=-updated_at");
    setDecks(data.results);
    if (!deckId && data.results.length) setDeckId(data.results[0].id);
  };

  const loadCards = async (id: number) => {
    const data = await api<Paginated<FlashCard>>(`/flash/cards/?deck=${id}&ordering=due_at&page_size=200`);
    setCards(data.results);
  };

  const loadLeeches = async () => {
    try {
      const data = await api<{ count: number; results: FlashCard[] }>("/flash/leeches/");
      setLeechCount(data.count);
      setLeeches(data.results);
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    loadDecks().catch((e) => setError(String(e?.message ?? e)));
    loadLeeches();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!deckId) return;
    loadCards(deckId).catch((e) => setError(String(e?.message ?? e)));
  }, [deckId]);

  const addCard = async () => {
    if (!deckId || selected?.is_locked) return;
    const f = front.trim(), b = back.trim();
    if (!f || !b) return;
    setBusy(true);
    setError(null);
    try {
      await api<FlashCard>("/flash/cards/", "POST", { deck: deckId, front: f, back: b, tags: [] });
      setFront(""); setBack("");
      await Promise.all([loadCards(deckId), loadDecks()]);
    } catch (e: any) { setError(String(e?.message ?? e)); }
    finally { setBusy(false); }
  };

  const deleteCard = async (id: number) => {
    if (!deckId || selected?.is_locked) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/flash/cards/${id}/`, "DELETE");
      await Promise.all([loadCards(deckId), loadDecks()]);
    } catch (e: any) { setError(String(e?.message ?? e)); }
    finally { setBusy(false); }
  };

  const unsuspendLeech = async (cardId: number) => {
    setBusy(true);
    try {
      await api(`/flash/leeches/${cardId}/unsuspend/`, "POST");
      await loadLeeches();
      if (deckId) await loadCards(deckId);
    } catch (e: any) { setError(String(e?.message ?? e)); }
    finally { setBusy(false); }
  };

  if (mode === "review" && deckId) {
    return (
      <ReviewView
        deckId={deckId}
        deckName={selected?.name ?? ""}
        limit={plan.flashcardLimit}
        onDone={async () => { setMode("manage"); await loadDecks(); }}
      />
    );
  }

  return (
    <div>
      <PageHeader title="Flashcards" subtitle={`${plan.label} — ${plan.studyCue}`} />

      {error && <div className="notice notice--bad" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Leech banner */}
      {leechCount > 0 && (
        <div className="fc-leech-banner">
          <span className="fc-leech-banner__icon">⚠</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {leechCount} leech{leechCount > 1 ? "es" : ""}
            </span>
            <span className="ui-meta" style={{ fontSize: 13, marginLeft: 8 }}>cards that failed 8+ times</span>
          </div>
          <button className="btn" style={{ fontSize: 12 }} onClick={() => setShowLeeches((v) => !v)}>
            {showLeeches ? "Hide" : "View"}
          </button>
        </div>
      )}

      {showLeeches && leeches.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card__title">Leech Cards</div>
          <div style={{ display: "grid", gap: 8 }}>
            {leeches.map((c) => (
              <div key={c.id} className="fc-leech-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{c.front}</div>
                  <div className="ui-meta" style={{ fontSize: 12, marginTop: 2 }}>
                    {c.lapses} lapses · {decks.find((d) => d.id === c.deck)?.name ?? `Deck ${c.deck}`}
                  </div>
                </div>
                <button className="btn" style={{ fontSize: 12 }} disabled={busy} onClick={() => unsuspendLeech(c.id)}>
                  Relearn
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid">
        {/* Deck sidebar */}
        <div className="card" style={{ gridColumn: "span 3" }}>
          <div className="card__title">Decks</div>
          <div style={{ display: "grid", gap: 5 }}>
            {decks.map((d) => (
              <button
                key={d.id}
                className={`deck-item${d.id === deckId ? " deck-item--active" : ""}`}
                onClick={() => { setDeckId(d.id); setMode("manage"); }}
              >
                <div className="deck-item__row">
                  <span className="deck-item__name">{d.name}</span>
                  <span className={`deck-due${d.due_count === 0 ? " deck-due--none" : ""}`}>{d.due_count}</span>
                </div>
                <div className="deck-item__meta">
                  <span className="pill">{d.jlpt_level}</span>
                  <span className="pill">{d.deck_type}</span>
                  <span className="pill" style={{ fontSize: 10 }}>{d.total_cards}c</span>
                </div>
              </button>
            ))}
            {!decks.length && <div className="pill">No decks — use Imports to create one.</div>}
          </div>

          {selected && (
            <button
              className="btn btn--primary"
              style={{ width: "100%", marginTop: 12 }}
              disabled={selected.due_count === 0}
              onClick={() => setMode("review")}
            >
              {selected.due_count > 0 ? `Study ${selected.due_count} due` : "All caught up"}
            </button>
          )}

          {me?.is_staff && selected && !selected.is_locked && (
            <button
              className="btn"
              style={{ width: "100%", marginTop: 8, fontSize: 12, color: "var(--bad)" }}
              disabled={busy}
              onClick={async () => {
                if (!confirm("Delete this deck and all its cards?")) return;
                setBusy(true);
                try {
                  await api(`/flash/decks/${selected.id}/`, "DELETE");
                  await loadDecks();
                  setDeckId(null);
                  setCards([]);
                } catch (e: any) { setError(String(e?.message ?? e)); }
                finally { setBusy(false); }
              }}
            >
              Delete deck
            </button>
          )}
        </div>

        {/* Main detail panel */}
        <div className="card" style={{ gridColumn: "span 9" }}>
          {!deckId ? (
            <div className="fc-empty">
              <div className="fc-empty__icon">🗂</div>
              <div className="fc-empty__title">Select a deck</div>
              <div className="fc-empty__sub">Choose a deck from the sidebar to see its details and start reviewing.</div>
            </div>
          ) : (
            <DeckDetail
              deck={selected!}
              cards={cards}
              busy={busy}
              front={front}
              back={back}
              setFront={setFront}
              setBack={setBack}
              onAdd={addCard}
              onDelete={deleteCard}
              onStartReview={() => setMode("review")}
              isManagement={me?.is_staff ?? false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
