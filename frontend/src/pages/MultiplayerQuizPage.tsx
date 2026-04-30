import { useCallback, useEffect, useRef, useState } from "react";
import type { JLPTLevel } from "../api/exam";

// ─── Types ────────────────────────────────────────────────────────────────────

type GameState = "setup" | "lobby" | "playing" | "reveal" | "finished";

interface Player { name: string; score: number }

interface QuizOption { id: number; label: string; text: string }

interface Question {
  index: number;
  total: number;
  text: string;
  passage: string;
  options: QuizOption[];
  duration: number;
}

interface RevealData {
  correct_id: number;
  explanation: string;
  scores: Player[];
  answers: Array<{ name: string; option_id: number; correct: boolean }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function wsUrl(code: string) {
  const host = window.location.hostname;
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${host}:8000/ws/quiz/${code}/`;
}

const LEVELS: JLPTLevel[] = ["N5", "N4", "N3", "N2", "N1"];
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 1;

// ─── Component ────────────────────────────────────────────────────────────────

export function MultiplayerQuizPage() {
  const [gameState, setGameState] = useState<GameState>("setup");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [level, setLevel] = useState<JLPTLevel>("N3");
  const [players, setPlayers] = useState<Player[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const [finalScores, setFinalScores] = useState<Player[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentCodeRef = useRef("");

  const send = useCallback((msg: object) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  const connect = useCallback((code: string, hosting: boolean) => {
    setError(null);
    const ws = new WebSocket(wsUrl(code));
    wsRef.current = ws;
    currentCodeRef.current = code;
    setRoomCode(code);
    setIsHost(hosting);

    ws.onopen = () => {
      setGameState("lobby");
      if (hosting) send({ action: "set_level", level });
    };

    ws.onclose = () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };

    ws.onerror = () => {
      setError("Could not connect. Make sure the backend is running with Daphne (not manage.py runserver).");
      setGameState("setup");
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "players_update") {
        setPlayers(msg.players);
        if (msg.state === "lobby") setGameState("lobby");
      }
      if (msg.type === "level_set") {
        setLevel(msg.level as JLPTLevel);
      }
      if (msg.type === "question") {
        setQuestion(msg as Question);
        setReveal(null);
        setSelectedOption(null);
        setTimeLeft(msg.duration);
        setGameState("playing");

        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setTimeLeft((t) => {
            if (t <= 1) {
              clearInterval(timerRef.current!);
              return 0;
            }
            return t - 1;
          });
        }, 1000);
      }
      if (msg.type === "reveal") {
        if (timerRef.current) clearInterval(timerRef.current);
        setReveal(msg as RevealData);
        setPlayers(msg.scores);
        setGameState("reveal");
      }
      if (msg.type === "game_over") {
        setFinalScores(msg.scores);
        setGameState("finished");
      }
      if (msg.type === "error") {
        setError(msg.message);
      }
    };
  }, [level, send]);

  useEffect(() => () => wsRef.current?.close(), []);

  const handleAnswer = (optId: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optId);
    send({ action: "answer", option_id: optId });
  };

  // ── Setup screen ────────────────────────────────────────────────────────────

  if (gameState === "setup") {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="card">
          <div className="card__title">Multiplayer Quiz</div>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 20 }}>
            Race 2–4 players on JLPT questions in real-time. Requires the backend to be
            running via <code>daphne jlpt_neuro_master.asgi:application</code>.
          </p>

          {error && (
            <div style={{ color: "#f87171", fontSize: 13, padding: "8px 12px", background: "rgba(248,113,113,0.1)", borderRadius: 6, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
              Create a room
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {LEVELS.map((l) => (
                <button key={l} className={level === l ? "btn btn--primary" : "btn"} onClick={() => setLevel(l)}>
                  {l}
                </button>
              ))}
            </div>
            <button className="btn btn--primary" style={{ width: "100%" }} onClick={() => connect(randomCode(), true)}>
              Create Room
            </button>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 16 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
              Join a room
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="field"
                placeholder="Room code (e.g. AB3X)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
                style={{ flex: 1, letterSpacing: 4, fontWeight: 700 }}
              />
              <button className="btn" onClick={() => joinCode && connect(joinCode, false)} disabled={!joinCode}>
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Lobby ────────────────────────────────────────────────────────────────────

  if (gameState === "lobby") {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            Room code — share with friends
          </div>
          <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: 10, marginBottom: 8 }}>{roomCode}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            <span className="pill">{level}</span>
            <span className="pill">{players.length} / {MAX_PLAYERS} players</span>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Players</div>
            {players.map((p) => (
              <div key={p.name} className="pill" style={{ margin: 4, display: "inline-block" }}>{p.name}</div>
            ))}
          </div>

          {isHost && (
            <button
              className="btn btn--primary"
              style={{ width: "100%" }}
              onClick={() => send({ action: "start_game" })}
              disabled={players.length < MIN_PLAYERS}
            >
              Start Game
            </button>
          )}
          {!isHost && <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 14 }}>Waiting for host to start…</div>}
        </div>
      </div>
    );
  }

  // ── Playing ──────────────────────────────────────────────────────────────────

  if ((gameState === "playing" || gameState === "reveal") && question) {
    const revealCorrectId = reveal?.correct_id;
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span className="pill">Q{question.index + 1} / {question.total}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {players.map((p) => (
              <span key={p.name} className="pill">{p.name}: {p.score}</span>
            ))}
          </div>
          {gameState === "playing" && (
            <span className="pill" style={{ color: timeLeft <= 5 ? "#f87171" : undefined }}>
              ⏱ {timeLeft}s
            </span>
          )}
        </div>

        <div className="card">
          {question.passage && (
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, marginBottom: 14, padding: "10px", background: "rgba(255,255,255,0.04)", borderRadius: 6, lineHeight: 1.8 }}>
              {question.passage}
            </div>
          )}

          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, lineHeight: 1.6 }}>
            {question.text}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {question.options.map((opt) => {
              let bg = "rgba(255,255,255,0.06)";
              let border = "rgba(255,255,255,0.12)";
              if (revealCorrectId !== undefined) {
                if (opt.id === revealCorrectId) { bg = "rgba(74,222,128,0.15)"; border = "#4ade80"; }
                else if (opt.id === selectedOption) { bg = "rgba(248,113,113,0.15)"; border = "#f87171"; }
              } else if (opt.id === selectedOption) {
                bg = "rgba(167,139,250,0.2)"; border = "#a78bfa";
              }
              return (
                <button
                  key={opt.id}
                  onClick={() => gameState === "playing" && handleAnswer(opt.id)}
                  disabled={selectedOption !== null || gameState === "reveal"}
                  style={{
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: 8,
                    padding: "12px 14px",
                    textAlign: "left",
                    color: "#fff",
                    cursor: selectedOption !== null || gameState === "reveal" ? "default" : "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    gap: 10,
                    alignItems: "baseline",
                  }}
                >
                  <strong>{opt.label}.</strong> {opt.text}
                </button>
              );
            })}
          </div>

          {gameState === "reveal" && reveal && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
              <strong>Explanation: </strong>{reveal.explanation || "—"}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Finished ─────────────────────────────────────────────────────────────────

  if (gameState === "finished") {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
          <div className="card__title">Game Over!</div>
          {finalScores.length > 0 && (
            <div style={{ fontSize: 18, margin: "8px 0 16px", fontWeight: 600 }}>
              Winner: {finalScores[0].name} — {finalScores[0].score} pts
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {finalScores.map((p, i) => (
              <div key={p.name} style={{
                display: "flex", justifyContent: "space-between",
                background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 14px",
              }}>
                <span>{i + 1}. {p.name}</span>
                <span>{p.score} pts</span>
              </div>
            ))}
          </div>
          <button className="btn btn--primary" onClick={() => { wsRef.current?.close(); setGameState("setup"); setPlayers([]); setQuestion(null); }}>
            Play Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}
