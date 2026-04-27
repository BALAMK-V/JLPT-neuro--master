import { useEffect, useMemo, useState } from "react";
import { api } from "../app/api/client";
import { getLearningStylePlan } from "../app/learningStyle";
import { useMe } from "../app/state/user";
import { PageHeader } from "../components/PageHeader";
import { ReadingMcq } from "../components/reading/ReadingMcq";
import { ReadingPassageView } from "../components/reading/ReadingPassageView";
import type { Paginated, ReadingPassage, ReadingQuestion } from "../types";

export function ReadingPage() {
  const { me } = useMe();
  const plan = getLearningStylePlan(me?.profile);
  const [items, setItems] = useState<ReadingPassage[]>([]);
  const [selected, setSelected] = useState<ReadingPassage | null>(null);
  const [level, setLevel] = useState<string>(me?.profile.jlpt_level ?? "N2");
  const [pattern, setPattern] = useState<string>(plan.readingPattern);
  const [questionType, setQuestionType] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filterType = useMemo(() => pattern.trim(), [pattern]);

  const loadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ ordering: "-updated_at" });
      if (level) qs.set("jlpt_level", level);
      if (filterType) qs.set("passage_type", filterType);

      const data = await api<Paginated<ReadingPassage>>(`/reading/passages/?${qs.toString()}`);
      setItems(data.results);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const open = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const full = await api<ReadingPassage>(`/reading/passages/${id}/`);
      setSelected(full);
      setQuestionType("");
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, filterType]);

  if (error) return <div className="card">Error: {error}</div>;

  const filteredQuestions = (selected?.questions ?? []).filter((q) => !questionType || q.question_type === questionType);

  return (
    <div>
      <PageHeader title="Reading" subtitle={`${plan.label}: ${plan.studyCue}`} />

      {plan.showGuidance || plan.reduceChoiceNoise ? (
        <div className="notice">
          <strong>Reading setup:</strong> start with {plan.readingPattern} passages and finish one passage before switching tasks.
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

        <select className="field" value={pattern} onChange={(e) => setPattern(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="short">short</option>
          <option value="medium">medium</option>
          <option value="long">long</option>
          <option value="integrated">integrated</option>
          <option value="info_search">info_search</option>
        </select>

        {selected && !plan.reduceChoiceNoise ? (
          <select className="field" value={questionType} onChange={(e) => setQuestionType(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">All question types</option>
            <option value="main_idea">main_idea</option>
            <option value="detail">detail</option>
            <option value="inference">inference</option>
            <option value="purpose">purpose</option>
            <option value="vocab">vocab</option>
            <option value="reference">reference</option>
            <option value="info_search">info_search</option>
            <option value="other">other</option>
          </select>
        ) : null}

        <button className="btn" onClick={() => loadList()} disabled={loading}>
          Refresh
        </button>
        {selected ? (
          <button className="btn" onClick={() => setSelected(null)}>
            Back to list
          </button>
        ) : null}
      </div>

      {loading ? <div className="card">Loading...</div> : null}

      {!selected ? (
        <div className="grid">
          {items.map((p) => (
            <button
              key={p.id}
              className="card"
              style={{ gridColumn: "span 6", textAlign: "left", cursor: "pointer" }}
              onClick={() => open(p.id)}
            >
              <div className="card__title">{p.title}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="pill">{p.jlpt_level}</span>
                <span className="pill">{p.passage_type}</span>
                {p.passage_type === plan.readingPattern ? <span className="pill">Good fit</span> : null}
              </div>
              <div style={{ marginTop: 10, color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
                {p.text_jp.slice(0, 160)}{p.text_jp.length > 160 ? "..." : ""}
              </div>
            </button>
          ))}
          {!loading && items.length === 0 ? (
            <div className="card" style={{ gridColumn: "span 12" }}>
              No reading passages yet. Import them from Admin or the Imports page.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid">
          <ReadingPassageView passage={selected} />
          {selected.questions?.length ? (
            filteredQuestions.length ? (
              filteredQuestions.map((q: ReadingQuestion) => <ReadingMcq key={q.id} q={q} />)
            ) : (
              <div className="card" style={{ gridColumn: "span 12" }}>
                No questions match this filter.
              </div>
            )
          ) : (
            <div className="card" style={{ gridColumn: "span 12" }}>
              No questions in this passage.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
