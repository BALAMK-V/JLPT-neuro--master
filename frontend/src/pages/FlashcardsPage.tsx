import { useEffect, useMemo, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    loadDecks().catch((e) => setError(String(e?.message ?? e)));
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
    if (!deckId) return;
    if (selected?.is_locked) return;
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
    if (!deckId) return;
    if (selected?.is_locked) return;
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

  const importCsv = async (file: File) => {
    if (!deckId) return;
    if (selected?.is_locked) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("csv_file", file, file.name);
      form.append("deck_id", String(deckId));
      const res = await apiForm<{ created: number; skipped: number }>("/flash/import/", "POST", form);
      await loadCards(deckId);
      await loadDecks();
      alert(`Imported flashcards. created=${res.created}, skipped=${res.skipped}`);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Flashcards" subtitle={`${plan.label}: ${plan.studyCue}`} />

      {error ? <div className="card">Error: {error}</div> : null}

      <div className="notice">
        <strong>Review setup:</strong> this style uses about {plan.flashcardLimit} due cards per pass and a {plan.sessionMinutes}-minute target.
      </div>

      <div className="toolbar">
        <button className={mode === "manage" ? "btn btn--primary" : "btn"} onClick={() => setMode("manage")}>
          Manage
        </button>
        <button className={mode === "review" ? "btn btn--primary" : "btn"} onClick={() => setMode("review")} disabled={!deckId}>
          Review
        </button>
      </div>

      <div className="grid">
        <div className="card" style={{ gridColumn: "span 4" }}>
          <div className="card__title">Decks</div>
          <div style={{ display: "grid", gap: 8 }}>
            {decks.map((d) => (
              <button
                key={d.id}
                className={d.id === deckId ? "btn btn--active" : "btn"}
                onClick={() => setDeckId(d.id)}
                style={{ textAlign: "left" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>{d.name}</div>
                  <span className="pill">{d.jlpt_level}</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <span className="pill">{d.deck_type}</span>
                  <span className="pill">due {d.due_count}</span>
                  <span className="pill">cards {d.total_cards}</span>
                </div>
              </button>
            ))}
            {!decks.length ? <div className="pill">No decks yet</div> : null}
          </div>

          <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>New deck</div>
            <input className="field field--sm" placeholder="Deck name" value={newDeckName} onChange={(e) => setNewDeckName(e.target.value)} />
            <div className="toolbar" style={{ marginTop: 8 }}>
              <select className="field field--sm" value={newDeckType} onChange={(e) => setNewDeckType(e.target.value)} style={{ maxWidth: 160 }}>
                <option value="kanji">kanji</option>
                <option value="vocab">vocab</option>
                <option value="custom">custom</option>
              </select>
              <button className="btn" disabled={busy} onClick={createDeck}>
                Create
              </button>
            </div>
          </div>

          {selected ? (
            <div style={{ marginTop: 12 }}>
              {selected.is_locked ? (
                <div className="pill">Default deck (locked)</div>
              ) : (
                <button className="btn" disabled={busy} onClick={() => deleteDeck(selected.id)}>
                  Delete deck
                </button>
              )}
            </div>
          ) : null}
        </div>

        <div className="card" style={{ gridColumn: "span 8" }}>
          {!deckId ? (
            <div className="pill">Select a deck</div>
          ) : mode === "manage" ? (
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
            />
          ) : (
            <ReviewView deckId={deckId} limit={plan.flashcardLimit} oneCardAtATime={plan.oneCardAtATime} onDone={() => { setMode("manage"); loadDecks(); }} />
          )}
        </div>
      </div>
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
  onImport: (file: File) => Promise<void>;
}) {
  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className="card__title" style={{ marginBottom: 0 }}>{deck.name}</div>
        <span className="pill">{deck.deck_type}</span>
        <span className="pill">{deck.jlpt_level}</span>
        {deck.is_locked ? <span className="pill">locked</span> : null}
      </div>

      <div style={{ marginTop: 10 }} className="notice">
        {deck.is_locked ? (
          <>This is a default deck. Cards are auto-generated from Admin Kanji/Vocabulary for this JLPT level.</>
        ) : (
          <>Import CSV headers: <code>front, back, tags, kanji_character, vocab_word, vocab_reading</code></>
        )}
      </div>

      {!deck.is_locked ? (
        <>
          <div className="toolbar">
            <input className="field field--sm" placeholder="Front" value={front} onChange={(e) => setFront(e.target.value)} />
            <input className="field field--sm" placeholder="Back" value={back} onChange={(e) => setBack(e.target.value)} />
            <button className="btn btn--primary" disabled={busy || !front.trim() || !back.trim()} onClick={() => onAdd()}>
              Add
            </button>
          </div>

          <div className="toolbar" style={{ marginTop: 8 }}>
            <input
              className="field field--sm"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
              }}
            />
          </div>
        </>
      ) : null}

      <div className="tablewrap" style={{ marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th>Front</th>
              <th>Back</th>
              <th style={{ width: 120 }}>Due</th>
              <th style={{ width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td style={{ whiteSpace: "pre-wrap" }}>{c.front}</td>
                <td style={{ whiteSpace: "pre-wrap", color: "rgba(255,255,255,0.75)" }}>{c.back}</td>
                <td>{new Date(c.due_at).toLocaleString()}</td>
                <td>
                  <button className="btn" disabled={busy} onClick={() => onDelete(c.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!cards.length ? (
              <tr>
                <td colSpan={5} style={{ padding: 14, color: "rgba(255,255,255,0.7)" }}>
                  No cards yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReviewView({
  deckId,
  limit,
  oneCardAtATime,
  onDone,
}: {
  deckId: number;
  limit: number;
  oneCardAtATime: boolean;
  onDone: () => void;
}) {
  const [queue, setQueue] = useState<FlashCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = queue[idx] ?? null;

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ count: number; results: FlashCard[] }>(`/flash/next/?deck_id=${deckId}&limit=${limit}`);
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
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await api<FlashCard>("/flash/review/", "POST", { card_id: current.id, rating });
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

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className="card__title" style={{ marginBottom: 0 }}>Review</div>
        <span className="pill">due {queue.length}</span>
        <span className="pill">batch {limit}</span>
        {oneCardAtATime ? <span className="pill">single-card flow</span> : null}
        <button className="btn" onClick={onDone}>
          Back
        </button>
        <button className="btn" disabled={busy} onClick={() => load()}>
          Refresh
        </button>
      </div>

      {error ? <div className="error" style={{ marginTop: 10 }}>{error}</div> : null}
      {busy ? <div className="pill" style={{ marginTop: 10 }}>Working...</div> : null}

      {!current ? (
        <div className="card" style={{ marginTop: 12, boxShadow: "none" }}>
          No due cards right now.
        </div>
      ) : (
        <div className="card" style={{ marginTop: 12, boxShadow: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span className="pill">#{current.id}</span>
            <span className="pill">EF {current.ease_factor.toFixed(2)}</span>
            <span className="pill">int {current.interval_days}d</span>
          </div>

          <div style={{ marginTop: 12, fontWeight: 900 }}>Front</div>
          <div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{current.front}</div>

          {showBack ? (
            <>
              <div style={{ marginTop: 12, fontWeight: 900 }}>Back</div>
              <div style={{ whiteSpace: "pre-wrap", marginTop: 8, color: "rgba(255,255,255,0.8)" }}>{current.back}</div>
            </>
          ) : null}

          <div className="toolbar" style={{ marginTop: 12 }}>
            {!showBack ? (
              <button className="btn btn--primary" onClick={() => setShowBack(true)}>
                Show answer
              </button>
            ) : (
              <>
                <button className="btn" disabled={busy} onClick={() => rate("again")}>Again</button>
                <button className="btn" disabled={busy} onClick={() => rate("hard")}>Hard</button>
                <button className="btn btn--primary" disabled={busy} onClick={() => rate("good")}>Good</button>
                <button className="btn" disabled={busy} onClick={() => rate("easy")}>Easy</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
