import { useEffect, useState } from "react";
import { api, API_BASE } from "../app/api/client";
import { getLearningStylePlan } from "../app/learningStyle";
import { useMe } from "../app/state/user";
import { PageHeader } from "../components/PageHeader";
import type { ListeningQuestion, Paginated } from "../types";

function resolveMediaUrl(pathOrUrl: string) {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  const host = API_BASE.replace("/api", "");
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${host}${p}`;
}

export function ListeningPage() {
  const { me } = useMe();
  const plan = getLearningStylePlan(me?.profile);
  const [items, setItems] = useState<ListeningQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<string>(me?.profile.jlpt_level ?? "N2");
  const [section, setSection] = useState<string>(plan.listeningSection);
  const [qtype, setQtype] = useState<string>("");
  const [showTranscripts, setShowTranscripts] = useState(plan.alias === "calm_structure");

  useEffect(() => {
    const qs = new URLSearchParams({ ordering: "-created_at" });
    if (level) qs.set("jlpt_level", level);
    if (section) qs.set("section", section);
    if (qtype) qs.set("question_type", qtype);

    api<Paginated<ListeningQuestion>>(`/listening/questions/?${qs.toString()}`)
      .then((d) => setItems(d.results))
      .catch((e) => setError(String(e.message ?? e)));
  }, [level, section, qtype]);

  return (
    <div>
      <PageHeader title="Listening" subtitle={`${plan.label}: ${plan.studyCue}`} />
      {error ? <div className="card">Error: {error}</div> : null}

      {plan.showGuidance || plan.reduceChoiceNoise ? (
        <div className="notice">
          <strong>Listening setup:</strong> start with {section || "any"} practice, then review the transcript after your first listen.
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

        <select className="field" value={section} onChange={(e) => setSection(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">All sections</option>
          <option value="kadai">kadai</option>
          <option value="point">point</option>
          <option value="gaiyo">gaiyo</option>
          <option value="sokuji">sokuji</option>
          <option value="togo">togo</option>
          <option value="other">other</option>
        </select>

        {!plan.reduceChoiceNoise ? (
          <select className="field" value={qtype} onChange={(e) => setQtype(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">All types</option>
            <option value="gist">gist</option>
            <option value="detail">detail</option>
            <option value="inference">inference</option>
            <option value="purpose">purpose</option>
            <option value="response">response</option>
            <option value="other">other</option>
          </select>
        ) : null}

        <button className={showTranscripts ? "btn btn--active" : "btn"} onClick={() => setShowTranscripts((v) => !v)}>
          Transcript
        </button>
        <button className="btn" onClick={() => { setSection(""); setQtype(""); }}>
          Clear
        </button>
      </div>

      <div className="grid">
        {items.map((q) => (
          <div className="card" key={q.id} style={{ gridColumn: "span 12" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div className="card__title" style={{ marginBottom: 0 }}>Q{q.id}</div>
              <span className="pill">{q.jlpt_level}</span>
              <span className="pill">{q.section || "other"}</span>
              <span className="pill">{q.question_type || "other"}</span>
              {q.section === plan.listeningSection ? <span className="pill">Good fit</span> : null}
            </div>

            <div style={{ marginTop: 10, color: "rgba(255,255,255,0.8)" }}>{q.question}</div>

            {showTranscripts && q.audio_text ? (
              <div style={{ marginTop: 10, whiteSpace: "pre-wrap", color: "rgba(255,255,255,0.7)" }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Audio text</div>
                {q.audio_text}
              </div>
            ) : null}

            {q.audio_file ? (
              <audio controls src={resolveMediaUrl(q.audio_file)} style={{ width: "100%", marginTop: 10 }} />
            ) : (
              <div className="pill" style={{ marginTop: 10 }}>No audio</div>
            )}

            {q.explanation ? <div style={{ marginTop: 10, color: "rgba(255,255,255,0.65)" }}>{q.explanation}</div> : null}
          </div>
        ))}
        {items.length === 0 && !error ? (
          <div className="card" style={{ gridColumn: "span 12" }}>
            No listening questions yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
