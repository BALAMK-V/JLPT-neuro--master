import { useEffect, useMemo, useState } from "react";
import { api } from "../app/api/client";
import { getLearningStylePlan } from "../app/learningStyle";
import { useMe } from "../app/state/user";
import { PageHeader } from "../components/PageHeader";
import { KanjiCard } from "../components/KanjiCard";
import type { Kanji, Paginated } from "../types";

export function KanjiPage() {
  const { me } = useMe();
  const plan = getLearningStylePlan(me?.profile);
  const [items, setItems] = useState<Kanji[]>([]);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<string>(me?.profile.jlpt_level ?? "N2");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    if (level) qs.set("jlpt_level", level);
    if (search) qs.set("search", search);

    api<Paginated<Kanji>>(`/kanji/?${qs.toString()}`)
      .then((data) => setItems(data.results))
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, [search, level]);

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

      {loading ? <div className="card">Loading...</div> : null}
      {error ? <div className="card">Error: {error}</div> : null}

      <div className="grid">
        {items.map((k) => (
          <KanjiCard key={k.id} kanji={k} />
        ))}
        {!loading && !error && items.length === 0 ? (
          <div className="card" style={{ gridColumn: "span 12" }}>
            No results.
          </div>
        ) : null}
      </div>
    </div>
  );
}
