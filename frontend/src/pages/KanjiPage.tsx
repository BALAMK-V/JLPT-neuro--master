import { useEffect, useMemo, useState } from "react";
import { api, API_BASE } from "../app/api/client";
import { getLearningStylePlan } from "../app/learningStyle";
import { useMe } from "../app/state/user";
import { PageHeader } from "../components/PageHeader";
import { KanjiCard } from "../components/KanjiCard";
import type { Kanji, Paginated } from "../types";

const PAGE_SIZE = 50;

function nextPathFrom(nextUrl: string | null): string | null {
  if (!nextUrl) return null;
  return nextUrl.replace(API_BASE, "");
}

export function KanjiPage() {
  const { me } = useMe();
  const plan = getLearningStylePlan(me?.profile);
  const [items, setItems] = useState<Kanji[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<string>(me?.profile.jlpt_level ?? "N2");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFurigana, setShowFurigana] = useState(false);

  const search = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setItems([]);
    setNextUrl(null);

    const qs = new URLSearchParams();
    if (level) qs.set("jlpt_level", level);
    if (search) qs.set("search", search);
    qs.set("page_size", String(PAGE_SIZE));

    api<Paginated<Kanji>>(`/kanji/?${qs.toString()}`)
      .then((data) => {
        setItems(data.results);
        setTotalCount(data.count);
        setNextUrl(nextPathFrom(data.next));
      })
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, [search, level]);

  const loadMore = () => {
    if (!nextUrl || loadingMore) return;
    setLoadingMore(true);
    api<Paginated<Kanji>>(nextUrl)
      .then((data) => {
        setItems((prev) => [...prev, ...data.results]);
        setTotalCount(data.count);
        setNextUrl(nextPathFrom(data.next));
      })
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoadingMore(false));
  };

  return (
    <div>
      <PageHeader title="Kanji" subtitle={`${plan.label}: ${plan.studyCue}`} />

      {plan.showGuidance || plan.reduceChoiceNoise ? (
        <div className="notice">
          <strong>Kanji setup:</strong> keep the batch near {plan.defaultQuestionCount} characters and review examples after recognition.
        </div>
      ) : null}

      <div className="toolbar">
        <select className="field" value={level} onChange={(e) => setLevel(e.target.value)} style={{ maxWidth: 140 }}>
          <option value="">All</option>
          <option value="N5">N5</option>
          <option value="N4">N4</option>
          <option value="N3">N3</option>
          <option value="N2">N2</option>
          <option value="N1">N1</option>
        </select>
        {!plan.reduceChoiceNoise ? (
          <input
            className="field"
            placeholder="Search: meaning, onyomi, kunyomi"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div className="ui-meta" style={{ fontSize: 13 }}>
          {!loading && totalCount > 0 && (
            <>Showing {items.length} of <strong>{totalCount}</strong> kanji</>
          )}
        </div>
        <button
          className="btn"
          onClick={() => setShowFurigana((v) => !v)}
          style={{ fontSize: 12 }}
        >
          {showFurigana ? "Hide Furigana" : "Show Furigana"}
        </button>
      </div>

      {loading ? <div className="card">Loading…</div> : null}
      {error ? <div className="notice notice--bad">{error}</div> : null}

      <div className="grid">
        {items.map((k) => (
          <KanjiCard key={k.id} kanji={k} showFurigana={showFurigana} />
        ))}
        {!loading && !error && items.length === 0 ? (
          <div className="card" style={{ gridColumn: "span 12" }}>No results.</div>
        ) : null}
      </div>

      {nextUrl && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
          <button
            className="btn btn--primary"
            style={{ minWidth: 200 }}
            disabled={loadingMore}
            onClick={loadMore}
          >
            {loadingMore
              ? "Loading…"
              : `Load more (${items.length} / ${totalCount})`}
          </button>
        </div>
      )}
    </div>
  );
}
