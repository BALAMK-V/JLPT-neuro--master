import { useState } from "react";
import { api } from "../app/api/client";
import type { JLPTLevel } from "../api/exam";

interface GrammarError {
  fragment: string;
  correction: string;
  explanation: string;
}

interface GrammarResult {
  sentence: string;
  is_correct: boolean;
  naturalness: "natural" | "unnatural" | "incorrect";
  corrected: string;
  overall_comment: string;
  errors: GrammarError[];
  jlpt_points: string[];
}

const NATURALNESS_COLOR: Record<string, string> = {
  natural: "#4ade80",
  unnatural: "#facc15",
  incorrect: "#f87171",
};

const LEVELS: JLPTLevel[] = ["N5", "N4", "N3", "N2", "N1"];

export function GrammarCheckPage() {
  const [sentence, setSentence] = useState("");
  const [level, setLevel] = useState<JLPTLevel | "">("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GrammarResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    const trimmed = sentence.trim();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await api<GrammarResult>("/grammar/check/", "POST", {
        sentence: trimmed,
        jlpt_level: level || undefined,
      });
      setResult(data);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setError(
        msg.includes("not configured")
          ? "AI grammar check is not configured — add ANTHROPIC_API_KEY to your .env file."
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) check();
  };

  return (
    <div className="grid" style={{ maxWidth: 780, margin: "0 auto" }}>
      {/* Input card */}
      <div className="card" style={{ gridColumn: "span 12" }}>
        <div className="card__title">AI Grammar Checker</div>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 12 }}>
          Type a Japanese sentence and Claude will check grammar, naturalness, and relevant JLPT patterns.
          Press <kbd style={{ background: "rgba(255,255,255,0.12)", borderRadius: 4, padding: "1px 5px" }}>Ctrl+Enter</kbd> to submit.
        </p>

        <textarea
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          onKeyDown={handleKey}
          placeholder="例：私は毎日日本語を勉強します。"
          rows={3}
          maxLength={500}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 8,
            color: "#fff",
            fontSize: 18,
            padding: "10px 14px",
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as JLPTLevel | "")}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 8,
              color: "#fff",
              padding: "6px 12px",
              fontSize: 14,
            }}
          >
            <option value="">Level (optional)</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <button
            className="btn"
            onClick={check}
            disabled={loading || !sentence.trim()}
            style={{ minWidth: 120 }}
          >
            {loading ? "Checking…" : "Check Grammar"}
          </button>

          {sentence.length > 0 && (
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: "auto" }}>
              {sentence.length}/500
            </span>
          )}
        </div>

        {error && (
          <div style={{ color: "#f87171", marginTop: 12, fontSize: 13, padding: "8px 12px", background: "rgba(248,113,113,0.1)", borderRadius: 6 }}>
            {error}
          </div>
        )}
      </div>

      {/* Result card */}
      {result && (
        <div className="card" style={{ gridColumn: "span 12" }}>
          {/* Verdict header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{
              fontSize: 28,
              lineHeight: 1,
            }}>
              {result.is_correct ? "✓" : "✗"}
            </span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {result.is_correct ? "Correct" : "Needs correction"}
              </div>
              <span style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 999,
                background: `${NATURALNESS_COLOR[result.naturalness]}22`,
                color: NATURALNESS_COLOR[result.naturalness],
                border: `1px solid ${NATURALNESS_COLOR[result.naturalness]}55`,
                textTransform: "capitalize",
              }}>
                {result.naturalness}
              </span>
            </div>
          </div>

          {/* Overall comment */}
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 16, lineHeight: 1.7 }}>
            {result.overall_comment}
          </p>

          {/* Corrected sentence (if different) */}
          {result.corrected && result.corrected !== result.sentence && (
            <div style={{
              background: "rgba(74,222,128,0.08)",
              border: "1px solid rgba(74,222,128,0.25)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, color: "rgba(74,222,128,0.7)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
                Corrected
              </div>
              <div style={{ fontSize: 18, color: "#4ade80" }}>{result.corrected}</div>
            </div>
          )}

          {/* Errors list */}
          {result.errors.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                Errors ({result.errors.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {result.errors.map((err, i) => (
                  <div key={i} style={{
                    background: "rgba(248,113,113,0.07)",
                    border: "1px solid rgba(248,113,113,0.2)",
                    borderRadius: 8,
                    padding: "10px 14px",
                  }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{ color: "#f87171", fontSize: 16 }}>{err.fragment}</span>
                      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>→</span>
                      <span style={{ color: "#4ade80", fontSize: 16 }}>{err.correction}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
                      {err.explanation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* JLPT grammar points */}
          {result.jlpt_points.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                JLPT Grammar Points
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.jlpt_points.map((pt, i) => (
                  <span key={i} className="pill" style={{ fontSize: 13 }}>{pt}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
