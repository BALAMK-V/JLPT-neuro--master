import { useEffect, useMemo, useState } from "react";
import { api } from "../app/api/client";
import { getLearningStylePlan } from "../app/learningStyle";
import { useMe } from "../app/state/user";
import { PageHeader } from "../components/PageHeader";
import { Caption } from "../components/ui";
import type { GrammarQuestion, Paginated } from "../types";

function GrammarCard({ q }: { q: GrammarQuestion }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const correct = submitted && selected === q.answer;

  return (
    <div className="card" style={{ gridColumn: "span 12" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div className="card__title" style={{ marginBottom: 0 }}>Q{q.id}</div>
        <span className="pill">{q.jlpt_level}</span>
        <span className="pill">{q.section}</span>
        <span className="pill">{q.question_type}</span>
      </div>

      {q.context_text_jp ? (
        <Caption style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{q.context_text_jp}</Caption>
      ) : null}
      <div style={{ marginTop: 10 }}>{q.prompt}</div>

      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {(["A", "B", "C", "D"] as const).map((k) => {
          const text = k === "A" ? q.option_a : k === "B" ? q.option_b : k === "C" ? q.option_c : q.option_d;
          return (
            <button
              key={k}
              className="btn"
              onClick={() => !submitted && setSelected(k)}
              style={{
                textAlign: "left",
                opacity: submitted && selected !== k ? 0.6 : 1,
                borderColor: submitted && k === q.answer ? "rgba(36,209,143,0.8)" : undefined,
              }}
            >
              {k}. {text}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
        {!submitted ? (
          <button
            className="btn btn--primary"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              setSubmitted(true);
            }}
          >
            Check
          </button>
        ) : (
          <span className="pill" style={{ color: correct ? "rgba(36,209,143,0.95)" : "rgba(255,92,122,0.95)" }}>
            {correct ? "Correct" : `Wrong (Answer: ${q.answer})`}
          </span>
        )}

        {submitted ? (
          <button
            className="btn"
            onClick={() => {
              setSubmitted(false);
              setSelected(null);
            }}
          >
            Try again
          </button>
        ) : null}
      </div>

      {submitted && q.explanation ? (
        <Caption style={{ marginTop: 10 }}>{q.explanation}</Caption>
      ) : null}
    </div>
  );
}

export function GrammarPage() {
  const { me } = useMe();
  const plan = getLearningStylePlan(me?.profile);
  const [items, setItems] = useState<GrammarQuestion[]>([]);
  const [level, setLevel] = useState<string>(me?.profile.jlpt_level ?? "N2");
  const [section, setSection] = useState<string>("");
  const [qtype, setQtype] = useState<string>("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => {
    const qs: string[] = ["ordering=-created_at"];
    if (level) qs.push(`jlpt_level=${encodeURIComponent(level)}`);
    if (section) qs.push(`section=${encodeURIComponent(section)}`);
    if (qtype) qs.push(`question_type=${encodeURIComponent(qtype)}`);
    return qs.join("&");
  }, [level, section, qtype]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api<Paginated<GrammarQuestion>>(`/grammar/questions/?${query}`)
      .then((d) => {
        setItems(d.results);
        setActiveIndex(0);
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [query]);

  const visibleItems = plan.oneCardAtATime ? items.slice(activeIndex, activeIndex + 1) : items;

  return (
    <div>
      <PageHeader title="Grammar" subtitle={`${plan.label}: ${plan.studyCue}`} />

      {plan.oneCardAtATime || plan.reduceChoiceNoise ? (
        <div className="notice">
          <strong>Grammar setup:</strong> {plan.oneCardAtATime ? "one question at a time" : "fewer filters visible"} with a {plan.sessionMinutes}-minute target.
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

        <select className="field" value={section} onChange={(e) => setSection(e.target.value)} style={{ maxWidth: 240 }}>
          <option value="">All sections</option>
          <option value="bunpo_form">bunpo_form</option>
          <option value="sentence_build">sentence_build</option>
          <option value="text_grammar">text_grammar</option>
          <option value="other">other</option>
        </select>

        {!plan.reduceChoiceNoise ? (
          <select className="field" value={qtype} onChange={(e) => setQtype(e.target.value)} style={{ maxWidth: 240 }}>
            <option value="">All types</option>
            <option value="choose">choose</option>
            <option value="fill_blank">fill_blank</option>
            <option value="reorder">reorder</option>
            <option value="error_find">error_find</option>
            <option value="other">other</option>
          </select>
        ) : null}

        <button className="btn" onClick={() => { setSection(""); setQtype(""); }} disabled={loading}>
          Clear
        </button>
      </div>

      {plan.oneCardAtATime && items.length ? (
        <div className="toolbar">
          <span className="pill">{activeIndex + 1}/{items.length}</span>
          <button className="btn" disabled={activeIndex === 0} onClick={() => setActiveIndex((v) => Math.max(0, v - 1))}>
            Previous
          </button>
          <button className="btn btn--primary" disabled={activeIndex >= items.length - 1} onClick={() => setActiveIndex((v) => Math.min(items.length - 1, v + 1))}>
            Next
          </button>
        </div>
      ) : null}

      {error ? <div className="card">Error: {error}</div> : null}
      {loading ? <div className="card">Loading...</div> : null}

      <div className="grid">
        {visibleItems.map((q) => <GrammarCard key={q.id} q={q} />)}
        {!loading && !error && items.length === 0 ? (
          <div className="card" style={{ gridColumn: "span 12" }}>
            No grammar questions yet. Import them from Admin or the Imports page.
          </div>
        ) : null}
      </div>
    </div>
  );
}
