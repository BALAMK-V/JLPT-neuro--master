import { useEffect, useRef, useState } from "react";
import { api } from "../app/api/client";
import { useMe } from "../app/state/user";
import type { Paginated, Vocab } from "../types";

type SpeakState = "idle" | "listening" | "result";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

function isSpeechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function normalize(text: string) {
  return text.trim().toLowerCase().replace(/[。、！？\s]/g, "");
}

export function SpeakingModePage() {
  const { me } = useMe();
  const [cards, setCards] = useState<Vocab[]>([]);
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<SpeakState>("idle");
  const [transcript, setTranscript] = useState("");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const supported = isSpeechSupported();
  const level = me?.profile.jlpt_level ?? "N3";

  useEffect(() => {
    api<Paginated<Vocab>>(`/vocab/?jlpt_level=${level}&ordering=?`)
      .then((d) => {
        const shuffled = [...d.results].sort(() => Math.random() - 0.5).slice(0, 20);
        setCards(shuffled);
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [level]);

  const current = cards[index] ?? null;

  const startListening = () => {
    if (!current || !supported) return;
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition!;
    const rec = new SpeechRecognitionClass();
    rec.lang = "ja-JP";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (event) => {
      const said = event.results[0][0].transcript;
      setTranscript(said);

      const expected = current.reading || current.word;
      const correct = normalize(said) === normalize(expected) ||
        normalize(said) === normalize(current.word);
      setIsCorrect(correct);
      setScore((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
      setState("result");
    };

    rec.onerror = () => {
      setState("idle");
      setTranscript("");
    };

    recognitionRef.current = rec;
    rec.start();
    setState("listening");
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setState("idle");
  };

  const next = () => {
    setIndex((i) => Math.min(i + 1, cards.length - 1));
    setState("idle");
    setTranscript("");
    setIsCorrect(null);
  };

  const restart = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setIndex(0);
    setState("idle");
    setTranscript("");
    setIsCorrect(null);
    setScore({ correct: 0, total: 0 });
  };

  if (!supported) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: "40px auto", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🎤</div>
        <div className="card__title">Speech Recognition Not Available</div>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14 }}>
          Your browser doesn't support the Web Speech API. Try Chrome or Edge.
        </p>
      </div>
    );
  }

  if (loading) return <div className="card">Loading vocabulary…</div>;
  if (error) return <div className="card">Error: {error}</div>;
  if (!current || index >= cards.length) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: "40px auto", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
        <div className="card__title">Session Complete!</div>
        <p style={{ fontSize: 20, margin: "12px 0" }}>
          {score.correct} / {score.total} correct
          {" "}({score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%)
        </p>
        <button className="btn btn--primary" onClick={restart}>Practice Again</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      {/* Progress */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span className="pill">{index + 1} / {cards.length}</span>
        <span className="pill">{score.correct} correct</span>
        <span className="pill">{level}</span>
      </div>

      {/* Card */}
      <div className="card" style={{ textAlign: "center", padding: "32px 24px" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>
          Say the reading of this word
        </div>

        <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 8 }}>{current.word}</div>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", marginBottom: 24 }}>{current.meaning_en}</div>

        {/* Microphone button */}
        {state === "idle" && (
          <button
            className="btn btn--primary"
            onClick={startListening}
            style={{ fontSize: 18, padding: "14px 32px", borderRadius: 999 }}
          >
            🎤 Speak
          </button>
        )}

        {state === "listening" && (
          <div>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "rgba(248,113,113,0.2)",
              border: "2px solid #f87171",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, margin: "0 auto 12px",
              animation: "pulse 1s infinite",
            }}>
              🎤
            </div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginBottom: 12 }}>Listening…</div>
            <button className="btn" onClick={stopListening}>Cancel</button>
          </div>
        )}

        {state === "result" && (
          <div>
            <div style={{
              fontSize: 28,
              color: isCorrect ? "#4ade80" : "#f87171",
              marginBottom: 12,
            }}>
              {isCorrect ? "✓ Correct!" : "✗ Incorrect"}
            </div>

            {transcript && (
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", marginBottom: 8 }}>
                You said: <strong style={{ color: "#fff" }}>{transcript}</strong>
              </div>
            )}

            {!isCorrect && (
              <div style={{ fontSize: 14, color: "rgba(74,222,128,0.9)", marginBottom: 16 }}>
                Correct reading: <strong>{current.reading || current.word}</strong>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
              <button className="btn" onClick={startListening}>Try Again</button>
              <button className="btn btn--primary" onClick={next}>
                {index < cards.length - 1 ? "Next →" : "Finish"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
