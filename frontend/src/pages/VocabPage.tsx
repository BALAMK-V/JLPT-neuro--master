import { useEffect, useMemo, useState } from "react";
import { api } from "../app/api/client";
import { API_BASE } from "../app/api/client";
import { getLearningStylePlan } from "../app/learningStyle";
import { useMe } from "../app/state/user";
import { PageHeader } from "../components/PageHeader";
import { VocabCard } from "../components/VocabCard";
import { CustomSelect } from "../components/ui";
import type { Paginated, Vocab } from "../types";

const PAGE_SIZE = 50;

function nextPathFrom(nextUrl: string | null): string | null {
  if (!nextUrl) return null;
  // DRF returns an absolute URL — strip the base to get the path+query
  return nextUrl.replace(API_BASE, "");
}

export function VocabPage() {
  const { me } = useMe();
  const plan = getLearningStylePlan(me?.profile);
  const [items, setItems] = useState<Vocab[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<string>(me?.profile.jlpt_level ?? "N2");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFurigana, setShowFurigana] = useState(false);
  const [sortBy, setSortBy] = useState<"default" | "frequency">("default");

  const search = useMemo(() => query.trim(), [query]);

  // Fresh load whenever filters change
  useEffect(() => {
    setLoading(true);
    setError(null);
    setItems([]);
    setNextUrl(null);

    const qs = new URLSearchParams();
    if (level) qs.set("jlpt_level", level);
    if (search) qs.set("search", search);
    if (sortBy === "frequency") qs.set("ordering", "frequency_rank");
    qs.set("page_size", String(PAGE_SIZE));

    api<Paginated<Vocab>>(`/vocab/?${qs.toString()}`)
      .then((data) => {
        setItems(data.results);
        setTotalCount(data.count);
        setNextUrl(nextPathFrom(data.next));
      })
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, [search, level, sortBy]);

  const loadMore = () => {
    if (!nextUrl || loadingMore) return;
    setLoadingMore(true);
    api<Paginated<Vocab>>(nextUrl)
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
      <PageHeader title="Vocabulary" subtitle={`${plan.label}: ${plan.studyCue}`} />

      {plan.showGuidance || plan.reduceChoiceNoise ? (
        <div className="notice">
          <strong>Vocabulary setup:</strong> review about {plan.defaultQuestionCount} items before switching context.
        </div>
      ) : null}

      <div className="toolbar">
        <CustomSelect value={level} onChange={(e) => setLevel(e.target.value)} style={{ maxWidth: 140 }}>
          <option value="">All</option>
          <option value="N5">N5</option>
          <option value="N4">N4</option>
          <option value="N3">N3</option>
          <option value="N2">N2</option>
          <option value="N1">N1</option>
        </CustomSelect>
        {!plan.reduceChoiceNoise ? (
          <input
            className="field"
            placeholder="Search: word, reading, meaning"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div className="ui-meta" style={{ fontSize: 13 }}>
          {!loading && totalCount > 0 && (
            <>Showing {items.length} of <strong>{totalCount}</strong> words</>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <CustomSelect
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "default" | "frequency")}
            style={{ maxWidth: 180, fontSize: 12 }}
          >
            <option value="default">Sort: Default</option>
            <option value="frequency">Sort: Most Common First</option>
          </CustomSelect>
          <button
            className="btn"
            onClick={() => setShowFurigana((v) => !v)}
            style={{ fontSize: 12 }}
          >
            {showFurigana ? "Hide Furigana" : "Show Furigana"}
          </button>
        </div>
      </div>

      {loading ? <div className="card">Loading…</div> : null}
      {error ? <div className="notice notice--bad">{error}</div> : null}

      <div className="grid">
        {items.map((v) => (
          <VocabCard key={v.id} vocab={v} showFurigana={showFurigana} />
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
