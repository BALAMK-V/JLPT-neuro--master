import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../app/api/client";
import { apiForm } from "../app/api/form";
import { getLearningStylePlan } from "../app/learningStyle";
import { useMe } from "../app/state/user";
import { PageHeader } from "../components/PageHeader";
import type { FlashCard, FlashDeck, Paginated } from "../types";

type ViewMode = "manage" | "review";

export function FlashcardsPage() {
  const { me } = useMe();
  const plan = getLearningStylePlan(me?.profile);
  const [decks, setDecks] = useState<FlashDeck[]>([]);
  const [deckId, setDeckId] = useState<number | null>(null);
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [mode, setMode] = useState<ViewMode>("manage");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckType, setNewDeckType] = useState<string>("custom");
  const [newDeckAlgo, setNewDeckAlgo] = useState<"sm2" | "fsrs">("sm2");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leechCount, setLeechCount] = useState(0);
  const [showLeeches, setShowLeeches] = useState(false);
  const [leeches, setLeeches] = useState<FlashCard[]>([]);

  const selected = useMemo(() => decks.find((d) => d.id === deckId) ?? null, [decks, deckId]);

  const loadDecks = async () => {
    setError(null);
    const data = await api<Paginated<FlashDeck>>("/flash/decks/?ordering=-updated_at");
    setDecks(data.results);
    if (!deckId && data.results.length) setDeckId(data.results[0].id);
  };

  const loadCards = async (id: number) => {
    setError(null);
    const data = await api<Paginated<FlashCard>>(`/flash/cards/?deck=${id}&ordering=-updated_at`);
    setCards(data.results);
  };

  const loadLeeches = async () => {
    try {
      const data = await api<{ count: number; results: FlashCard[] }>("/flash/leeches/");
      setLeechCount(data.count);
      setLeeches(data.results);
    } catch {
      // non-critical
    }
  };

  const unsuspendLeech = async (cardId: number) => {
    setBusy(true);
    try {
      await api(`/flash/leeches/${cardId}/unsuspend/`, "POST");
      await loadLeeches();
      if (deckId) await loadCards(deckId);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadDecks().catch((e) => setError(String(e?.message ?? e)));
    loadLeeches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!deckId) return;
    loadCards(deckId).catch((e) => setError(String(e?.message ?? e)));
  }, [deckId]);

  const createDeck = async () => {
    const name = newDeckName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const d = await api<FlashDeck>("/flash/decks/", "POST", {
        name,
        deck_type: newDeckType,
        jlpt_level: me?.profile.jlpt_level ?? "N2",
        srs_algo: newDeckAlgo,
      });
      setNewDeckName("");
      await loadDecks();
      setDeckId(d.id);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const deleteDeck = async (id: number) => {
    const deck = decks.find((d) => d.id === id);
    if (deck?.is_locked) return;
    if (!confirm("Delete this deck and all cards?")) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/flash/decks/${id}/`, "DELETE");
      await loadDecks();
      setDeckId((d) => (d === id ? null : d));
      setCards([]);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const addCard = async () => {
    if (!deckId || selected?.is_locked) return;
    const f = front.trim();
    const b = back.trim();
    if (!f || !b) return;
    setBusy(true);
    setError(null);
    try {
      await api<FlashCard>("/flash/cards/", "POST", { deck: deckId, front: f, back: b, tags: [] });
      setFront("");
      setBack("");
      await loadCards(deckId);
      await loadDecks();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const deleteCard = async (id: number) => {
    if (!deckId || selected?.is_locked) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/flash/cards/${id}/`, "DELETE");
      await loadCards(deckId);
      await loadDecks();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const importCsv = async (file: File): Promise<string | null> => {
    if (!deckId || selected?.is_locked) return null;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("csv_file", file, file.name);
      form.append("deck_id", String(deckId));
      const res = await apiForm<{ created: number; skipped: number }>("/flash/import/", "POST", form);
      await loadCards(deckId);
      await loadDecks();
      return `Imported ${res.created} card${res.created !== 1 ? "s" : ""}${res.skipped ? `, skipped ${res.skipped}` : ""}.`;
    } catch (e: any) {
      setError(String(e?.message ?? e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const startReview = () => {
    setMode("review");
  };

  const exitReview = async () => {
    setMode("manage");
    await loadDecks();
  };

  return (
    <div>
      <PageHeader title="Flashcards" subtitle={`${plan.label}: ${plan.studyCue}`} />

      {error ? (
        <div className="notice notice--bad" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {leechCount > 0 && (
        <div className="fc-leech-banner">
          <span className="fc-leech-banner__icon">⚠</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {leechCount} leech{leechCount > 1 ? "es" : ""} need relearning
            </span>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginLeft: 8 }}>
              cards that failed 8+ times
            </span>
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
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
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

      {mode === "review" && deckId ? (
        <ReviewView
          deckId={deckId}
          deckName={selected?.name ?? ""}
          limit={plan.flashcardLimit}
          onDone={exitReview}
        />
      ) : (
        <div className="grid">
          {/* ── Deck sidebar ── */}
          <div className="card" style={{ gridColumn: "span 4" }}>
            <div className="card__title">My Decks</div>

            <div style={{ display: "grid", gap: 6 }}>
              {decks.map((d) => (
                <button
                  key={d.id}
                  className={`deck-item${d.id === deckId ? " deck-item--active" : ""}`}
                  onClick={() => { setDeckId(d.id); setMode("manage"); }}
                >
                  <div className="deck-item__row">
                    <span className="deck-item__name">{d.name}</span>
                    <span className={`deck-due${d.due_count === 0 ? " deck-due--none" : ""}`}>
                      {d.due_count}
                    </span>
                  </div>
                  <div className="deck-item__meta">
                    <span className="pill">{d.deck_type}</span>
                    <span className="pill">{d.jlpt_level}</span>
                    <span className="pill">{d.srs_algo ?? "sm2"}</span>
                  </div>
                </button>
              ))}
              {!decks.length ? (
                <div className="pill">No decks yet — create one below</div>
              ) : null}
            </div>

            {selected && (
              <div style={{ marginTop: 12 }}>
                <button
                  className="btn btn--primary"
                  style={{ width: "100%" }}
                  disabled={selected.due_count === 0}
                  onClick={startReview}
                >
                  {selected.due_count > 0
                    ? `Study ${selected.due_count} due card${selected.due_count !== 1 ? "s" : ""}`
                    : "No cards due"}
                </button>
              </div>
            )}

            {me?.is_staff && (
              <>
                <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>New deck</div>
                  <input
                    className="field field--sm"
                    placeholder="Deck name"
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") createDeck(); }}
                  />
                  <div className="toolbar" style={{ marginTop: 8 }}>
                    <select
                      className="field field--sm"
                      value={newDeckType}
                      onChange={(e) => setNewDeckType(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="kanji">Kanji</option>
                      <option value="vocab">Vocab</option>
                      <option value="custom">Custom</option>
                    </select>
                    <select
                      className="field field--sm"
                      value={newDeckAlgo}
                      onChange={(e) => setNewDeckAlgo(e.target.value as "sm2" | "fsrs")}
                      style={{ flex: 1 }}
                    >
                      <option value="sm2">SM-2</option>
                      <option value="fsrs">FSRS</option>
                    </select>
                    <button className="btn" disabled={busy || !newDeckName.trim()} onClick={createDeck}>
                      Create
                    </button>
                  </div>
                </div>

                {selected && !selected.is_locked && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      className="btn"
                      style={{ fontSize: 12, color: "var(--bad)", width: "100%" }}
                      disabled={busy}
                      onClick={() => deleteDeck(selected.id)}
                    >
                      Delete deck
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Main panel ── */}
          <div className="card" style={{ gridColumn: "span 8" }}>
            {!deckId ? (
              <div className="fc-empty">
                <div className="fc-empty__icon">🗂</div>
                <div className="fc-empty__title">Select a deck</div>
                <div className="fc-empty__sub">Choose a deck from the sidebar to start reviewing.</div>
              </div>
            ) : (
              <ManageCardsView
                deck={selected!}
                cards={cards}
                busy={busy}
                onAdd={addCard}
                onDelete={deleteCard}
                front={front}
                back={back}
                setFront={setFront}
                setBack={setBack}
                onImport={importCsv}
                onStartReview={startReview}
                isManagement={me?.is_staff ?? false}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ManageCardsView({
  deck,
  cards,
  busy,
  onAdd,
  onDelete,
  front,
  back,
  setFront,
  setBack,
  onImport,
  onStartReview,
  isManagement,
}: {
  deck: FlashDeck;
  cards: FlashCard[];
  busy: boolean;
  onAdd: () => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  front: string;
  back: string;
  setFront: (v: string) => void;
  setBack: (v: string) => void;
  onImport: (file: File) => Promise<string | null>;
  onStartReview: () => void;
  isManagement: boolean;
}) {
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const handleImport = async (file: File) => {
    setImportMsg(null);
    const msg = await onImport(file);
    if (msg) setImportMsg(msg);
  };

  return (
    <div>
      {/* Deck header */}
      <div className="fc-manage-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="card__title" style={{ marginBottom: 0 }}>{deck.name}</span>
            {deck.is_locked && <span className="pill">system deck</span>}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <span className="pill">{deck.deck_type}</span>
            <span className="pill">{deck.jlpt_level}</span>
            <span className="pill">{deck.srs_algo ?? "sm2"}</span>
            <span className="pill">{deck.total_cards} cards</span>
            {deck.due_count > 0 ? (
              <span className="pill" style={{ color: "var(--bad)" }}>{deck.due_count} due</span>
            ) : null}
          </div>
        </div>
        {deck.due_count > 0 && (
          <button className="btn btn--primary" onClick={onStartReview} style={{ flexShrink: 0 }}>
            Study {deck.due_count} due
          </button>
        )}
      </div>

      {deck.is_locked ? (
        <div className="notice" style={{ marginTop: 10 }}>
          This is a system deck. Cards are auto-generated from Kanji/Vocabulary for {deck.jlpt_level}.
        </div>
      ) : isManagement ? (
        <>
          {/* Add card */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Add card</div>
            <div className="fc-add-row">
              <textarea
                className="field fc-add-field"
                placeholder="Front (question / character)"
                value={front}
                rows={2}
                onChange={(e) => setFront(e.target.value)}
              />
              <textarea
                className="field fc-add-field"
                placeholder="Back (answer / meaning)"
                value={back}
                rows={2}
                onChange={(e) => setBack(e.target.value)}
              />
              <button
                className="btn btn--primary"
                disabled={busy || !front.trim() || !back.trim()}
                onClick={() => onAdd()}
                style={{ alignSelf: "flex-end" }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Import */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Import CSV</div>
            <div className="toolbar">
              <input
                className="field field--sm"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleImport(f);
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 5 }}>
              Headers: <code>front, back, tags, kanji_character, vocab_word</code>
            </div>
            {importMsg ? (
              <div className="notice notice--ok" style={{ marginTop: 8, fontSize: 13 }}>{importMsg}</div>
            ) : null}
          </div>
        </>
      ) : null}

      {/* Card table */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
          Cards ({cards.length})
        </div>
        {!cards.length ? (
          <div className="fc-empty" style={{ padding: "32px 20px" }}>
            <div className="fc-empty__icon" style={{ fontSize: 36 }}>📭</div>
            <div className="fc-empty__sub">No cards yet. Add one above or import a CSV.</div>
          </div>
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Front</th>
                  <th>Back</th>
                  <th style={{ width: 110 }}>Due</th>
                  <th style={{ width: 90 }}>Interval</th>
                  {isManagement && !deck.is_locked ? <th style={{ width: 90 }} /> : null}
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.id}>
                    <td style={{ whiteSpace: "pre-wrap", fontWeight: 600 }}>{c.front}</td>
                    <td style={{ whiteSpace: "pre-wrap", color: "rgba(255,255,255,0.7)" }}>{c.back}</td>
                    <td style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                      {new Date(c.due_at).toLocaleDateString()}
                    </td>
                    <td style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                      {c.interval_days}d
                    </td>
                    {isManagement && !deck.is_locked ? (
                      <td>
                        <button
                          className="btn"
                          style={{ fontSize: 12, padding: "5px 10px" }}
                          disabled={busy}
                          onClick={() => onDelete(c.id)}
                        >
                          Remove
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [showBack, setShowBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionDone, setSessionDone] = useState(0);

  const current = queue[idx] ?? null;

  // Refs so keyboard handler always sees fresh values
  const showBackRef = useRef(false);
  const busyRef = useRef(false);
  showBackRef.current = showBack;
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
      setShowBack(false);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

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
        setShowBack(false);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  // Store rate in a ref so keyboard handler always calls the latest version
  const rateRef = useRef<(r: "again" | "hard" | "good" | "easy") => Promise<void>>(rate);
  rateRef.current = rate;

  // Keyboard shortcuts — register once, use refs for live values
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === " " || e.key === "Enter") && !showBackRef.current) {
        e.preventDefault();
        setShowBack(true);
        return;
      }
      if (showBackRef.current && !busyRef.current) {
        if (e.key === "1") void rateRef.current("again");
        if (e.key === "2") void rateRef.current("hard");
        if (e.key === "3") { e.preventDefault(); void rateRef.current("good"); }
        if (e.key === "4") void rateRef.current("easy");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remaining = queue.length - idx;
  const total = sessionDone + remaining;
  const progressPct = total > 0 ? Math.round((sessionDone / total) * 100) : 0;

  if (!busy && !current) {
    return (
      <div className="fc-review">
        <div className="fc-empty" style={{ padding: "60px 20px" }}>
          <div className="fc-empty__icon">✓</div>
          <div className="fc-empty__title">All caught up!</div>
          <div className="fc-empty__sub">
            {sessionDone > 0
              ? `You reviewed ${sessionDone} card${sessionDone !== 1 ? "s" : ""} this session.`
              : "No cards due right now."}
          </div>
          <button className="btn btn--primary" onClick={onDone}>
            Back to Decks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fc-review">
      {/* Top bar */}
      <div className="fc-review__header">
        <button className="btn" onClick={onDone} style={{ flexShrink: 0 }}>
          ← {deckName}
        </button>
        <div className="fc-progress">
          <div className="fc-progress__track">
            <div className="fc-progress__bar" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="fc-progress__label">
            {sessionDone} reviewed · {remaining} remaining
          </span>
        </div>
        <button className="btn" disabled={busy} onClick={load} style={{ flexShrink: 0 }}>
          ↺
        </button>
      </div>

      {error ? (
        <div className="notice notice--bad" style={{ width: "100%", maxWidth: 640 }}>
          {error}
        </div>
      ) : null}

      {busy && !current ? (
        <div className="fc-card">
          <div className="fc-card__front" style={{ color: "rgba(255,255,255,0.3)", fontSize: "1.2rem" }}>
            Loading...
          </div>
        </div>
      ) : current ? (
        <div className={`fc-card${showBack ? " fc-card--flipped" : ""}`}>
          <div className="fc-card__front">{current.front}</div>

          {showBack ? (
            <>
              <div className="fc-divider" />
              <div className="fc-card__back">{current.back}</div>
            </>
          ) : null}

          <div className="fc-card__meta">
            {current.interval_days > 0 ? `${current.interval_days}d interval · ` : "new · "}
            EF {current.ease_factor.toFixed(2)}
          </div>
        </div>
      ) : null}

      {/* Action buttons */}
      {current && !showBack ? (
        <button className="btn btn--primary fc-show-btn" onClick={() => setShowBack(true)}>
          Show Answer <span className="fc-kbd">Space</span>
        </button>
      ) : current && showBack ? (
        <div className="fc-ratings">
          <button className="fc-rating fc-rating--again" disabled={busy} onClick={() => void rate("again")}>
            <span>Again</span>
            <kbd>1</kbd>
          </button>
          <button className="fc-rating fc-rating--hard" disabled={busy} onClick={() => void rate("hard")}>
            <span>Hard</span>
            <kbd>2</kbd>
          </button>
          <button className="fc-rating fc-rating--good" disabled={busy} onClick={() => void rate("good")}>
            <span>Good</span>
            <kbd>3</kbd>
          </button>
          <button className="fc-rating fc-rating--easy" disabled={busy} onClick={() => void rate("easy")}>
            <span>Easy</span>
            <kbd>4</kbd>
          </button>
        </div>
      ) : null}
    </div>
  );
}
