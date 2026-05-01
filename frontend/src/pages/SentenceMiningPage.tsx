import { useEffect, useState } from "react";
import { api } from "../app/api/client";
import { useMe } from "../app/state/user";
import type { FlashDeck, Paginated } from "../types";

interface MinedWord {
  word: string;
  reading: string;
  meaning: string;
  example_jp: string;
  example_en: string;
}

interface MineResult {
  words_found: number;
  cards_created: number;
  words: MinedWord[];
}

export function SentenceMiningPage() {
  const { me } = useMe();
  const [text, setText] = useState("");
  const [deckId, setDeckId] = useState<number | "">("");
  const [decks, setDecks] = useState<FlashDeck[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const level = me?.profile.jlpt_level ?? "N3";

  useEffect(() => {
    api<Paginated<FlashDeck>>("/flash/decks/?ordering=-updated_at")
      .then((d) => {
        setDecks(d.results);
        if (d.results.length) setDeckId(d.results[0].id);
      })
      .catch(() => {});
  }, []);

  const mine = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await api<MineResult>("/flash/mine/", "POST", {
        text: trimmed,
        deck_id: deckId || undefined,
        jlpt_level: level,
      });
      setResult(data);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setError(
        msg.includes("not configured")
          ? "Sentence mining not configured — add ANTHROPIC_API_KEY to .env."
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div className="card" style={{ gridColumn: "span 12" }}>
        <div className="card__title">Sentence Miner</div>
        <p className="ui-caption" style={{ fontSize: 13, marginBottom: 16 }}>
          Paste any Japanese text — manga, articles, songs. Claude identifies words you likely don't know
          yet at <strong>{level}</strong> level and optionally adds them as flashcards.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="日本語のテキストをここに貼り付けてください…"
          rows={6}
          maxLength={3000}
          style={{
            width: "100%",
            background: "var(--input-bg)",
            border: "1px solid var(--border-mid)",
            borderRadius: 8,
            color: "var(--text)",
            fontSize: 16,
            padding: "10px 14px",
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
            lineHeight: 1.8,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          {decks.length > 0 && (
            <select
              value={deckId}
              onChange={(e) => setDeckId(e.target.value ? Number(e.target.value) : "")}
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border-mid)",
                borderRadius: 8,
                color: "var(--text)",
                padding: "6px 12px",
                fontSize: 14,
                maxWidth: 240,
              }}
            >
              <option value="">Preview only (no cards)</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}

          <button
            className="btn btn--primary"
            onClick={mine}
            disabled={loading || !text.trim()}
            style={{ minWidth: 140 }}
          >
            {loading ? "Extracting…" : "Extract Words"}
          </button>

          <span className="ui-meta" style={{ fontSize: 12, marginLeft: "auto" }}>
            {text.length}/3000
          </span>
        </div>

        {error && (
          <div style={{ color: "var(--bad)", marginTop: 12, fontSize: 13, padding: "8px 12px", background: "rgba(255,92,122,0.1)", borderRadius: 6, border: "1px solid rgba(255,92,122,0.2)" }}>
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="card" style={{ gridColumn: "span 12" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
            <div className="card__title" style={{ marginBottom: 0 }}>
              {result.words_found} Words Found
            </div>
            {result.cards_created > 0 && (
              <span className="badge badge--success">
                {result.cards_created} cards added
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {result.words.map((w, i) => (
              <div key={i} style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "12px 14px",
              }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{w.word}</span>
                  {w.reading && (
                    <span className="ui-caption" style={{ fontSize: 14 }}>{w.reading}</span>
                  )}
                  <span className="ui-caption" style={{ fontSize: 14, marginLeft: "auto" }}>{w.meaning}</span>
                </div>
                {w.example_jp && (
                  <div className="ui-caption" style={{ fontSize: 13, marginTop: 4 }}>
                    {w.example_jp}
                    {w.example_en && <span className="ui-meta"> — {w.example_en}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <button className="btn" onClick={() => { setResult(null); setText(""); }}>
              Mine Another Text
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
