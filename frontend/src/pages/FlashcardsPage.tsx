import { useEffect, useRef, useState } from "react";
import { api } from "../app/api/client";
import { getLearningStylePlan } from "../app/learningStyle";
import { useMe } from "../app/state/user";
import { PageHeader } from "../components/PageHeader";
import { CustomSelect } from "../components/ui";
import { sanitizeHtml, safeUrl } from "../utils/security";
import type { FlashCard, FlashDeck, Paginated } from "../types";

// ── Furigana renderer ─────────────────────────────────────────────────────────

function parseFurigana(text: string): Array<{ t: string; r?: string }> {
  const out: Array<{ t: string; r?: string }> = [];
  const re = /([^\[]+)\[([^\]]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ t: text.slice(last, m.index) });
    out.push({ t: m[1], r: m[2] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}

function FuriganaText({
  text,
  furigana,
  className,
}: {
  text: string;
  furigana?: string;
  className?: string;
}) {
  if (!text) return null;
  if (text.includes("[") && text.includes("]")) {
    const parts = parseFurigana(text);
    return (
      <span className={className}>
        {parts.map((p, i) =>
          p.r ? (
            <ruby key={i}>{p.t}<rt>{p.r}</rt></ruby>
          ) : (
            <span key={i}>{p.t}</span>
          )
        )}
      </span>
    );
  }
  if (furigana) {
    return <ruby className={className}>{text}<rt>{furigana}</rt></ruby>;
  }
  return <span className={className}>{text}</span>;
}

// ── Inline audio player ───────────────────────────────────────────────────────

function CardAudio({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLAudioElement>(null);
  const safeSrc = safeUrl(src);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().catch(() => {});
      setPlaying(true);
    }
  };

  if (!safeSrc) return null;

  return (
    <div className="fc-audio">
      <audio ref={ref} src={safeSrc} onEnded={() => setPlaying(false)} preload="none" />
      <button
        className={`fc-audio__btn${playing ? " fc-audio__btn--playing" : ""}`}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
      >
        {playing ? "⏸" : "▶"} {playing ? "Pause" : "Play audio"}
      </button>
    </div>
  );
}

// ── Rich back-face content ────────────────────────────────────────────────────

function CardBackContent({ card }: { card: FlashCard }) {
  if (card.kanji && (card.kanji_onyomi || card.kanji_kunyomi || card.kanji_meaning)) {
    return (
      <div className="fc-rich-back">
        {card.kanji_onyomi && (
          <div className="fc-rich-row">
            <span className="fc-rich-label">音読み</span>
            <span className="fc-rich-value">{card.kanji_onyomi}</span>
          </div>
        )}
        {card.kanji_kunyomi && (
          <div className="fc-rich-row">
            <span className="fc-rich-label">訓読み</span>
            <span className="fc-rich-value">{card.kanji_kunyomi}</span>
          </div>
        )}
        <div
          className="fc-rich-meaning"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(card.kanji_meaning || card.back) }}
        />
      </div>
    );
  }
  if (card.vocab && (card.vocab_reading_detail || card.vocab_meaning)) {
    return (
      <div className="fc-rich-back">
        {card.vocab_reading_detail && (
          <div className="fc-rich-row">
            <span className="fc-rich-label">読み</span>
            <span className="fc-rich-value">{card.vocab_reading_detail}</span>
          </div>
        )}
        <div
          className="fc-rich-meaning"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(card.vocab_meaning || card.back) }}
        />
      </div>
    );
  }
  return (
    <div
      className="fc-anki-back__text"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(card.back) }}
    />
  );
}

// ── Edit card modal ───────────────────────────────────────────────────────────

function EditCardModal({
  card,
  onSave,
  onClose,
}: {
  card: FlashCard;
  onSave: (updated: FlashCard) => void;
  onClose: () => void;
}) {
  const [front, setFront] = useState(card.front);
  const [furigana, setFurigana] = useState(card.furigana ?? "");
  const [back, setBack] = useState(card.back);
  const [image, setImage] = useState(card.image ?? "");
  const [audio, setAudio] = useState(card.audio ?? "");
  const [tags, setTags] = useState((card.tags ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const updated = await api<FlashCard>(`/flash/cards/${card.id}/`, "PATCH", {
        front: front.trim(),
        furigana: furigana.trim(),
        back: back.trim(),
        image: image.trim(),
        audio: audio.trim(),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      onSave(updated);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box fc-edit-modal">
        <div className="modal-header">
          <span className="modal-title">Edit Card</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {err && <div className="notice notice--bad" style={{ marginBottom: 12 }}>{err}</div>}
        <div className="fc-edit-fields">
          <label className="fc-edit-label">Front</label>
          <textarea className="field" rows={3} value={front} onChange={(e) => setFront(e.target.value)} />

          <label className="fc-edit-label">
            Furigana <span className="ui-meta" style={{ fontSize: 11 }}>(reading shown above front text — supports inline 漢字[かんじ] notation too)</span>
          </label>
          <input className="field" value={furigana} onChange={(e) => setFurigana(e.target.value)} placeholder="e.g. かんじ" />

          <label className="fc-edit-label">Back</label>
          <textarea className="field" rows={4} value={back} onChange={(e) => setBack(e.target.value)} />

          <label className="fc-edit-label">Image URL</label>
          <input className="field" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://example.com/image.png" />
          {image && <img className="fc-edit-preview-img" src={image} alt="preview" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}

          <label className="fc-edit-label">Audio URL</label>
          <input className="field" value={audio} onChange={(e) => setAudio(e.target.value)} placeholder="https://example.com/audio.mp3" />

          <label className="fc-edit-label">
            Tags <span className="ui-meta" style={{ fontSize: 11 }}>(comma-separated)</span>
          </label>
          <input className="field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="N2, kanji, ..." />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn--primary"
            disabled={busy || !front.trim() || !back.trim()}
            onClick={save}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card preview modal ────────────────────────────────────────────────────────

function CardPreviewModal({
  card,
  onClose,
}: {
  card: FlashCard;
  onClose: () => void;
}) {
  const [showBack, setShowBack] = useState(false);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box fc-preview-modal">
        <div className="modal-header">
          <span className="modal-title">Card Preview</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="fc-preview-body">
          <div className="fc-preview-face">
            <div className="fc-preview-face-label">Front</div>
            <div className="fc-preview-front">
              <FuriganaText
                text={card.front}
                furigana={card.furigana}
                className="fc-preview-front__text"
              />
              {card.image && (
                <img className="fc-card-image" src={card.image} alt="" />
              )}
            </div>
          </div>

          {!showBack ? (
            <button
              className="btn btn--primary"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => setShowBack(true)}
            >
              Show Answer
            </button>
          ) : (
            <div className="fc-preview-face">
              <div className="fc-preview-face-label">Back</div>
              <div className="fc-preview-back">
                <div className="fc-preview-echo">{card.front}</div>
                <div className="fc-anki-divider" style={{ margin: "12px 0", width: "100%" }} />
                <CardBackContent card={card} />
                {card.audio && <CardAudio src={card.audio} />}
              </div>
            </div>
          )}

          {card.tags?.length > 0 && (
            <div className="fc-preview-tags">
              {card.tags.map((t) => <span key={t} className="pill">{t}</span>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  onEdit,
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
  onEdit: (updated: FlashCard) => void;
  onStartReview: () => void;
  isManagement: boolean;
}) {
  const now = Date.now();
  const dueCards = cards.filter((c) => !c.suspended && new Date(c.due_at).getTime() <= now);
  const newCards = cards.filter((c) => c.repetitions === 0 && !c.suspended);
  const learnCards = cards.filter((c) => c.repetitions > 0 && c.interval_days < 7 && !c.suspended);
  const reviewCards = cards.filter((c) => c.interval_days >= 7 && !c.suspended);

  const [editCard, setEditCard] = useState<FlashCard | null>(null);
  const [previewCard, setPreviewCard] = useState<FlashCard | null>(null);

  return (
    <div>
      {editCard && (
        <EditCardModal
          card={editCard}
          onSave={(updated) => { onEdit(updated); setEditCard(null); }}
          onClose={() => setEditCard(null)}
        />
      )}
      {previewCard && (
        <CardPreviewModal
          card={previewCard}
          onClose={() => setPreviewCard(null)}
        />
      )}

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
              placeholder="Front — question / character (use 漢字[かんじ] for inline furigana)"
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
                  <th style={{ width: 60 }}>Intv.</th>
                  <th style={{ width: 55 }}>Reps</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => {
                  const overdue = !c.suspended && new Date(c.due_at).getTime() <= Date.now();
                  return (
                    <tr key={c.id} style={c.suspended ? { opacity: 0.45 } : undefined}>
                      <td style={{ fontWeight: 600 }}>
                        <FuriganaText text={c.front} furigana={c.furigana} />
                        {c.image && (
                          <span className="pill" style={{ fontSize: 10, marginLeft: 6 }}>📷</span>
                        )}
                        {c.audio && (
                          <span className="pill" style={{ fontSize: 10, marginLeft: 4 }}>🔊</span>
                        )}
                      </td>
                      <td className="ui-caption" style={{ whiteSpace: "pre-wrap", maxWidth: 200, fontSize: 13 }}>
                        {c.back.split("\n")[0]}
                        {c.back.includes("\n") ? <span className="ui-meta"> …</span> : null}
                      </td>
                      <td className="ui-meta" style={{ fontSize: 12, color: overdue ? "var(--bad)" : undefined }}>
                        {c.suspended ? "suspended" : new Date(c.due_at).toLocaleDateString()}
                      </td>
                      <td className="ui-meta" style={{ fontSize: 12 }}>{c.interval_days}d</td>
                      <td className="ui-meta" style={{ fontSize: 12 }}>{c.repetitions}</td>
                      <td>
                        <div className="fc-row-actions">
                          <button
                            className="btn fc-row-btn"
                            title="Preview"
                            onClick={() => setPreviewCard(c)}
                          >
                            👁
                          </button>
                          {isManagement && !deck.is_locked && (
                            <>
                              <button
                                className="btn fc-row-btn"
                                title="Edit"
                                disabled={busy}
                                onClick={() => setEditCard(c)}
                              >
                                ✎
                              </button>
                              <button
                                className="btn fc-row-btn"
                                title="Remove"
                                style={{ color: "var(--bad)" }}
                                disabled={busy}
                                onClick={() => onDelete(c.id)}
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                      </td>
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

// ── Review (Anki-style) ───────────────────────────────────────────────────────

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
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionDone, setSessionDone] = useState(0);

  // Track per-session "again" counts to avoid infinite loops
  const againCounts = useRef<Record<number, number>>({});

  const current = queue[0] ?? null;

  const flippedRef = useRef(false);
  const busyRef = useRef(false);
  flippedRef.current = flipped;
  busyRef.current = busy;

  const load = async () => {
    setBusy(true);
    setLoaded(false);
    setError(null);
    try {
      const res = await api<{ count: number; results: FlashCard[] }>(
        `/flash/next/?deck_id=${deckId}&limit=${limit}`
      );
      setQueue(res.results);
      setFlipped(false);
      againCounts.current = {};
      setLoaded(true);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, [deckId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rate = async (rating: "again" | "hard" | "good" | "easy") => {
    if (!current || busyRef.current) return;
    setBusy(true);
    setError(null);
    try {
      await api<FlashCard>("/flash/review/", "POST", { card_id: current.id, rating });

      let newQueue: FlashCard[];
      const [head, ...rest] = queue;

      if (rating === "again") {
        // Re-insert card further in queue so it comes back this session.
        // Cap at 3 retries per card to prevent infinite loops.
        const fails = (againCounts.current[head.id] ?? 0) + 1;
        againCounts.current[head.id] = fails;
        if (fails < 3) {
          newQueue = [...rest];
          const pos = Math.min(3, newQueue.length);
          newQueue.splice(pos, 0, head);
        } else {
          // Give up on this card for the session, move on
          newQueue = rest;
        }
      } else {
        newQueue = rest;
        setSessionDone((s) => s + 1);
      }

      setFlipped(false);

      if (newQueue.length === 0) {
        // Fetch more due cards — if empty, done screen shows
        setBusy(true);
        try {
          const res = await api<{ count: number; results: FlashCard[] }>(
            `/flash/next/?deck_id=${deckId}&limit=${limit}`
          );
          setQueue(res.results);
          againCounts.current = {};
        } catch (e: any) {
          setError(String(e?.message ?? e));
        } finally {
          setBusy(false);
        }
      } else {
        setQueue(newQueue);
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
      if ((e.key === " " || e.key === "Enter") && !flippedRef.current) {
        e.preventDefault();
        setFlipped(true);
        return;
      }
      if (flippedRef.current && !busyRef.current) {
        if (e.key === "1") void rateRef.current("again");
        if (e.key === "2") void rateRef.current("hard");
        if (e.key === "3") { e.preventDefault(); void rateRef.current("good"); }
        if (e.key === "4") void rateRef.current("easy");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = queue.length;
  const total = sessionDone + remaining;
  const progressPct = total > 0 ? Math.round((sessionDone / total) * 100) : 0;

  // Done: loaded (not initial), not busy, queue empty
  if (loaded && !busy && queue.length === 0) {
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
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!flipped) setFlipped(true);
            }
          }}
        >
          {/* Front face */}
          <div className="fc-anki-front">
            <div className="fc-anki-front__content">
              {busy && !current ? (
                <span className="ui-meta">Loading…</span>
              ) : current ? (
                <>
                  <FuriganaText
                    text={current.front}
                    furigana={current.furigana}
                    className="fc-anki-front__text"
                  />
                  {current.image && (
                    <img className="fc-card-image" src={safeUrl(current.image)} alt="" />
                  )}
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

          {/* Back face */}
          <div className="fc-anki-back">
            <div className="fc-anki-back__content">
              <FuriganaText
                text={current?.front ?? ""}
                furigana={current?.furigana}
                className="fc-anki-back__front-echo"
              />
              <div className="fc-anki-divider" />
              {current && <CardBackContent card={current} />}
              {current?.audio && <CardAudio src={current.audio} />}
              {current?.image && (
                <img className="fc-card-image fc-card-image--back" src={safeUrl(current.image)} alt="" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rating buttons */}
      {current && flipped ? (
        <div className="fc-ratings">
          <button className="fc-rating fc-rating--again" disabled={busy} onClick={() => void rate("again")}>
            <span className="fc-rating__label">Again</span>
            <span className="fc-rating__sub">&lt;10min · retry</span>
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
  const [sessionLimit, setSessionLimit] = useState<number>(plan.flashcardLimit);

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

  const editCard = (updated: FlashCard) => {
    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
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
        limit={sessionLimit}
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
                  <div style={{ fontSize: 14 }}>
                    <FuriganaText text={c.front} furigana={c.furigana} />
                  </div>
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
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="fc-session-limit">
                <label className="fc-session-limit__label">Cards / session</label>
                <CustomSelect
                  size="sm"
                  style={{ maxWidth: 90 }}
                  value={String(sessionLimit)}
                  onChange={(e) => setSessionLimit(Number(e.target.value))}
                >
                  {[5, 10, 15, 20, 25, 30, 50, 100].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </CustomSelect>
              </div>
              <button
                className="btn btn--primary"
                style={{ width: "100%" }}
                disabled={selected.due_count === 0}
                onClick={() => setMode("review")}
              >
                {selected.due_count > 0 ? `Study ${selected.due_count} due` : "All caught up"}
              </button>
            </div>
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
              onEdit={editCard}
              onStartReview={() => setMode("review")}
              isManagement={me?.is_staff ?? false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
