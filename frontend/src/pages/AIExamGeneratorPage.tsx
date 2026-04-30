import { useState } from "react";
import { api } from "../app/api/client";
import { setRoute } from "../app/state/route";
import type { JLPTLevel } from "../api/exam";

type SectionOption = "vocabulary" | "grammar" | "reading" | "full";

interface GenerateResult {
  exam_id: number;
  title: string;
  level: JLPTLevel;
  section_type: string;
  question_count: number;
  duration_minutes: number;
}

const SECTIONS: { key: SectionOption; label: string; desc: string }[] = [
  { key: "vocabulary", label: "語彙 Vocabulary", desc: "25 vocabulary questions" },
  { key: "grammar", label: "文法 Grammar", desc: "20 grammar pattern questions" },
  { key: "reading", label: "読解 Reading", desc: "15 reading comprehension questions" },
  { key: "full", label: "Full Exam", desc: "60 mixed questions (vocab + grammar + reading)" },
];

const LEVELS: JLPTLevel[] = ["N5", "N4", "N3", "N2", "N1"];

export function AIExamGeneratorPage() {
  const [level, setLevel] = useState<JLPTLevel>("N3");
  const [section, setSection] = useState<SectionOption>("vocabulary");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await api<GenerateResult>("/exams/ai-generate/", "POST", { level, section });
      setResult(data);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setError(
        msg.includes("not configured")
          ? "AI exam generation not configured — add ANTHROPIC_API_KEY to .env."
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="card" style={{ gridColumn: "span 12" }}>
        <div className="card__title">AI Exam Generator</div>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 20 }}>
          Claude generates a realistic JLPT practice exam from scratch — no paper upload needed.
          The exam is saved immediately and available for review in the JLPT Exam section.
        </p>

        {/* Level picker */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            JLPT Level
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {LEVELS.map((l) => (
              <button
                key={l}
                className={level === l ? "btn btn--primary" : "btn"}
                onClick={() => setLevel(l)}
                style={{ minWidth: 56 }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Section picker */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            Section
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                style={{
                  background: section === s.key ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${section === s.key ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.12)"}`,
                  borderRadius: 8,
                  padding: "12px 14px",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14, color: section === s.key ? "#a78bfa" : "#fff", marginBottom: 4 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn btn--primary"
          onClick={generate}
          disabled={loading}
          style={{ width: "100%", padding: "12px", fontSize: 15 }}
        >
          {loading ? "Claude is writing your exam…" : `Generate ${level} ${section === "full" ? "Full Exam" : section.charAt(0).toUpperCase() + section.slice(1)} Exam`}
        </button>

        {loading && (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 12 }}>
            This takes 15–30 seconds. Claude is crafting authentic JLPT-style questions…
          </p>
        )}

        {error && (
          <div style={{
            marginTop: 14, color: "#f87171", fontSize: 13,
            background: "rgba(248,113,113,0.08)", borderRadius: 8, padding: "10px 14px",
          }}>
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="card" style={{ gridColumn: "span 12" }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>✓</div>
          <div className="card__title" style={{ marginBottom: 6 }}>{result.title}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <span className="pill">{result.level}</span>
            <span className="pill">{result.question_count} questions</span>
            <span className="pill">{result.duration_minutes} min</span>
          </div>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, marginBottom: 16 }}>
            Your exam has been saved and is ready to take. Head to the JLPT Exam section to start it.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn--primary" onClick={() => setRoute("jlptExam")}>
              Go to JLPT Exam →
            </button>
            <button
              className="btn"
              onClick={() => { setResult(null); setError(null); }}
            >
              Generate Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
