import { useCallback, useEffect, useRef, useState } from "react";
import type { JLPTLevel } from "../api/exam";
import type { AvatarConfig, PlayerProfile, QuizReplay, QuizHistoryEntry } from "../types";
import { PlayerAvatar } from "../components/quiz/PlayerAvatar";
import { PlayerNameTag } from "../components/quiz/PlayerNameTag";
import { AvatarBuilder } from "../components/quiz/AvatarBuilder";
import { ChatPanel } from "../components/quiz/ChatPanel";
import { VoiceChat } from "../components/quiz/VoiceChat";
import { useMe } from "../app/state/user";
import { api } from "../app/api/client";

// ─── Types ───────────────────────────────────────────────────────────────────

type GameState = "setup" | "lobby" | "playing" | "reveal" | "finished" | "replay";

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
  scores: PlayerProfile[];
  answers: Array<{ user_id: number | null; name: string; option_id: number; correct: boolean; response_time_ms: number }>;
  round_index: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function wsUrl(code: string) {
  const host = window.location.hostname;
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const token = localStorage.getItem("access_token") || "";
  return `${proto}://${host}:8000/ws/quiz/${code}/?token=${encodeURIComponent(token)}`;
}

const LEVELS: JLPTLevel[] = ["N5", "N4", "N3", "N2", "N1"];
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 1;

const DEFAULT_AVATAR: AvatarConfig = {
  skin_tone: "#f5d0b0",
  hair_style: "short",
  hair_color: "#2c2c2c",
  eye_shape: "round",
  eye_color: "#4a7c59",
  accessory: "none",
};

// ─── Mini components ──────────────────────────────────────────────────────────

function AnswerToast({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 80,
        right: 20,
        background: "var(--accent)",
        color: "#fff",
        borderRadius: 8,
        padding: "8px 14px",
        fontSize: 13,
        fontWeight: 600,
        zIndex: 999,
        animation: "fadeInOut 2s ease forwards",
      }}
    >
      {text}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MultiplayerQuizPage() {
  const { me } = useMe();

  const [gameState, setGameState] = useState<GameState>("setup");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [level, setLevel] = useState<JLPTLevel>("N3");
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const [finalScores, setFinalScores] = useState<PlayerProfile[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  const [myAvatar, setMyAvatar] = useState<Partial<AvatarConfig>>(
    me?.profile?.avatar_config || DEFAULT_AVATAR
  );
  const [displayName, setDisplayName] = useState(
    me?.profile?.display_name || me?.profile?.nickname || me?.username || ""
  );

  // Replay state
  const [replay, setReplay] = useState<QuizReplay | null>(null);
  const [replayRound, setReplayRound] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [replayScores, setReplayScores] = useState<Record<string, number>>({});

  // History
  const [history, setHistory] = useState<QuizHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [lastGameId, setLastGameId] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const replayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync avatar from me
  useEffect(() => {
    if (me?.profile?.avatar_config) setMyAvatar(me.profile.avatar_config);
    if (me?.profile?.display_name || me?.profile?.nickname || me?.username) {
      setDisplayName(me.profile?.display_name || me.profile?.nickname || me.username);
    }
  }, [me]);

  const send = useCallback((msg: object) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  // Chat, files, voice state
  const [chatMessages, setChatMessages] = useState<Array<{ user_id: number | null; name: string; text: string; ts: number }>>([]);
  const [sharedFiles, setSharedFiles] = useState<Array<{ user_id: number | null; name: string; filename: string; file_url: string; file_type: string; ts: number }>>([]);
  const [voiceSignal, setVoiceSignal] = useState<{
    type: "voice_offer" | "voice_answer" | "voice_ice" | "voice_mute";
    from: number | null;
    from_name: string;
    sdp?: string;
    candidate?: string;
    muted?: boolean;
  } | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const connect = useCallback((code: string, hosting: boolean) => {
    setError(null);
    const ws = new WebSocket(wsUrl(code));
    wsRef.current = ws;
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
      setError("Could not connect. Make sure the backend is running via daphne.");
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
            if (t <= 1) { clearInterval(timerRef.current!); return 0; }
            return t - 1;
          });
        }, 1000);
      }
      if (msg.type === "answer_received") {
        setPlayers((prev) =>
          prev.map((p) =>
            p.user_id === msg.player.user_id || p.name === msg.player.name
              ? { ...p, answered: true, streak: msg.player.streak, response_time_ms: msg.player.response_time_ms }
              : p
          )
        );
        showToast(`${msg.player.name} answered (${msg.answered_count}/${msg.total_players})`);
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
        // Try to get game ID from recent history
        setTimeout(() => {
          api<{ results?: QuizHistoryEntry[]; length?: number } | QuizHistoryEntry[]>("/quiz/history/")
            .then((data) => {
              const entries = Array.isArray(data) ? data : (data as any);
              if (entries && entries.length > 0) setLastGameId(entries[0].game_id);
            })
            .catch(() => {});
        }, 1500);
      }
      // Chat
      if (msg.type === "chat_history") {
        setChatMessages(msg.messages || []);
      }
      if (msg.type === "chat_message") {
        setChatMessages((prev) => [...prev, msg.message]);
      }
      // Files
      if (msg.type === "file_history") {
        setSharedFiles(msg.files || []);
      }
      if (msg.type === "file_shared") {
        setSharedFiles((prev) => [...prev, msg.file]);
        showToast(`📎 ${msg.file.name} shared a file`);
      }
      // Voice signaling
      if (msg.type === "voice_offer" || msg.type === "voice_answer" || msg.type === "voice_ice") {
        setVoiceSignal({ type: msg.type, from: msg.from, from_name: msg.from_name, sdp: msg.sdp, candidate: msg.candidate });
      }
      if (msg.type === "voice_mute") {
        setVoiceSignal({ type: "voice_mute", from: msg.user_id, from_name: msg.name, muted: msg.muted });
      }

      if (msg.type === "error") {
        setError(msg.message);
      }
    };
  }, [level, send, showToast]);

  useEffect(() => () => wsRef.current?.close(), []);

  const handleAnswer = (optId: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optId);
    send({ action: "answer", option_id: optId });
  };

  const handleSendMessage = useCallback((text: string) => {
    send({ action: "chat_message", text });
  }, [send]);

  const handleShareFile = useCallback(async (file: File) => {
    const toBase64 = (f: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const b64 = result.split(",")[1] || result;
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
    };
    try {
      const fileData = await toBase64(file);
      send({
        action: "share_file",
        file_data: fileData,
        filename: file.name,
        file_type: file.type,
      });
    } catch {
      showToast("Failed to read file");
    }
  }, [send, showToast]);

  const handleVoiceSignal = useCallback((action: string, data: Record<string, unknown>) => {
    send({ action, ...data });
  }, [send]);

  const loadHistory = async () => {
    try {
      const data = await api<QuizHistoryEntry[]>("/quiz/history/");
      setHistory(Array.isArray(data) ? data : []);
    } catch { setHistory([]); }
    setShowHistory(true);
  };

  const loadReplay = async (gameId: number) => {
    try {
      const data = await api<QuizReplay>(`/quiz/replay/${gameId}/`);
      setReplay(data);
      setReplayRound(0);
      setReplayPlaying(false);
      setReplayScores(Object.fromEntries((data.players || []).map((p) => [p.name, 0])));
      setGameState("replay");
    } catch {
      setError("Could not load replay.");
    }
  };

  // Replay playback
  useEffect(() => {
    if (gameState !== "replay" || !replay || !replayPlaying) return;
    const delay = 2000 / replaySpeed;
    replayTimerRef.current = setInterval(() => {
      setReplayRound((r) => {
        if (r + 1 >= replay.rounds.length) {
          setReplayPlaying(false);
          return r;
        }
        const nextRound = replay.rounds[r + 1];
        if (nextRound?.scores) {
          const sc: Record<string, number> = {};
          nextRound.scores.forEach((s) => { sc[s.name] = s.score; });
          setReplayScores(sc);
        }
        return r + 1;
      });
    }, delay);
    return () => { if (replayTimerRef.current) clearInterval(replayTimerRef.current); };
  }, [gameState, replay, replayPlaying, replaySpeed]);

  const playerAvatarsMap: Record<string, Partial<AvatarConfig>> = {};
  players.forEach((p) => {
    if (p.avatar) playerAvatarsMap[p.name] = p.avatar;
    if (p.user_id) playerAvatarsMap[p.user_id.toString()] = p.avatar;
  });
  if (me?.profile?.avatar_config) {
    playerAvatarsMap[me.username] = me.profile.avatar_config;
    if (me.id) playerAvatarsMap[me.id.toString()] = me.profile.avatar_config;
  }

  const resetToSetup = () => {
    wsRef.current?.close();
    setGameState("setup");
    setPlayers([]);
    setQuestion(null);
    setReveal(null);
    setFinalScores([]);
    setReplay(null);
    setShowHistory(false);
    setError(null);
  };

  // ── Setup ─────────────────────────────────────────────────────────────────

  if (gameState === "setup") {
    return (
      <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {error && (
          <div style={{ color: "var(--bad)", fontSize: 13, padding: "8px 12px", background: "rgba(255,92,122,0.1)", border: "1px solid rgba(255,92,122,0.2)", borderRadius: 6 }}>
            {error}
          </div>
        )}

        <div className="card">
          <div className="card__title">Multiplayer Quiz</div>
          <p className="ui-caption" style={{ fontSize: 13, marginBottom: 20 }}>
            Race 2–4 players on JLPT questions in real-time.
          </p>

          {/* Player identity */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "10px 12px", background: "var(--surface)", borderRadius: 10 }}>
            <PlayerAvatar config={myAvatar} size={52} showLevel level={me?.level_info?.level} levelTitle={me?.level_info?.title} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                className="field"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                maxLength={30}
                style={{ marginBottom: 4, fontSize: 13 }}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {me?.level_info ? `Lv.${me.level_info.level} ${me.level_info.title} · ${me.level_info.xp} XP` : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Create room */}
        <div className="card">
          <div className="ui-meta" style={{ fontSize: 12, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            Create a room
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
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

        {/* Join room */}
        <div className="card">
          <div className="ui-meta" style={{ fontSize: 12, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
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

        {/* Quick question import */}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Need questions?</div>
          <p className="ui-caption" style={{ fontSize: 12, marginBottom: 10 }}>
            Import JLPT questions from CSV/JSON or use the Exam section to create exams. The quiz pulls from published exams.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" style={{ fontSize: 12 }} onClick={() => window.location.hash = "#exams"}>
              Go to Exams
            </button>
            <button className="btn" style={{ fontSize: 12 }} onClick={() => window.location.hash = "#paperUpload"}>
              Upload Paper
            </button>
          </div>
        </div>

        {/* History */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>Past Games</div>
            <button className="btn" style={{ fontSize: 11 }} onClick={loadHistory}>
              Load History
            </button>
          </div>
          {showHistory && (
            history.length === 0
              ? <div className="ui-caption" style={{ fontSize: 13 }}>No past games found.</div>
              : history.map((h) => (
                <div key={h.game_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <span className="pill" style={{ marginRight: 6 }}>{h.level}</span>
                    <span style={{ fontSize: 12 }}>Rank #{h.rank} · {h.score}pts · {h.correct_count}/{h.total_count}</span>
                  </div>
                  <button className="btn" style={{ fontSize: 11 }} onClick={() => loadReplay(h.game_id)}>
                    Replay
                  </button>
                </div>
              ))
          )}
        </div>

        <VoiceChat
          userId={me?.id ?? null}
          onSendSignaling={handleVoiceSignal}
          incomingSignaling={voiceSignal}
          roomCode={roomCode}
        />
        <ChatPanel
          messages={chatMessages}
          files={sharedFiles}
          onSendMessage={handleSendMessage}
          onShareFile={handleShareFile}
          myUserId={me?.id ?? null}
          playerAvatars={playerAvatarsMap}
        />
      </div>
    );
  }

  // ── Lobby ─────────────────────────────────────────────────────────────────

  if (gameState === "lobby") {
    return (
      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="ui-meta" style={{ fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            Room code — share with friends
          </div>
          <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: 10, marginBottom: 8 }}>{roomCode}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            <span className="pill">{level}</span>
            <span className="pill">{players.length} / {MAX_PLAYERS} players</span>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Players</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {players.map((p) => (
                <PlayerNameTag
                  key={p.user_id ?? p.name}
                  name={p.name}
                  avatar={p.avatar}
                  level={p.level}
                  levelTitle={p.level_title}
                />
              ))}
            </div>
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
          {!isHost && <div className="ui-caption" style={{ fontSize: 14 }}>Waiting for host to start…</div>}

          <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 8 }}>
            <VoiceChat
              userId={me?.id ?? null}
              onSendSignaling={handleVoiceSignal}
              incomingSignaling={voiceSignal}
              roomCode={roomCode}
            />
          </div>
        </div>

        <ChatPanel
          messages={chatMessages}
          files={sharedFiles}
          onSendMessage={handleSendMessage}
          onShareFile={handleShareFile}
          myUserId={me?.id ?? null}
          playerAvatars={playerAvatarsMap}
        />
      </div>
    );
  }

  // ── Playing / Reveal ──────────────────────────────────────────────────────

  if ((gameState === "playing" || gameState === "reveal") && question) {
    const revealCorrectId = reveal?.correct_id;
    return (
      <div style={{ maxWidth: 660, margin: "0 auto" }}>
        {toast && <AnswerToast text={toast} />}

        {/* Player bar */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, overflowX: "auto" }}>
          {players.map((p) => (
            <PlayerNameTag
              key={p.user_id ?? p.name}
              name={p.name}
              avatar={p.avatar}
              level={p.level}
              levelTitle={p.level_title}
              score={p.score}
              streak={p.streak}
              answered={p.answered}
              size="sm"
            />
          ))}
          {gameState === "playing" && (
            <span className="pill" style={{ marginLeft: "auto", color: timeLeft <= 5 ? "var(--bad)" : undefined, alignSelf: "center" }}>
              ⏱ {timeLeft}s
            </span>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <span className="pill">Q{question.index + 1} / {question.total}</span>
        </div>

        <div className="card">
          {question.passage && (
            <div className="ui-caption" style={{ fontSize: 14, marginBottom: 14, padding: "10px", background: "var(--surface)", borderRadius: 6, lineHeight: 1.8 }}>
              {question.passage}
            </div>
          )}

          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, lineHeight: 1.6 }}>
            {question.text}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {question.options.map((opt) => {
              let bg = "var(--surface)";
              let border = "var(--border-mid)";
              if (revealCorrectId !== undefined) {
                if (opt.id === revealCorrectId) { bg = "rgba(36,209,143,0.15)"; border = "var(--good)"; }
                else if (opt.id === selectedOption) { bg = "rgba(255,92,122,0.15)"; border = "var(--bad)"; }
              } else if (opt.id === selectedOption) {
                bg = "rgba(124,92,255,0.2)"; border = "var(--accent)";
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
                    color: "var(--text)",
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
            <>
              <div className="ui-caption" style={{ marginTop: 14, padding: "10px 14px", background: "var(--surface)", borderRadius: 8, fontSize: 13, lineHeight: 1.6 }}>
                <strong>Explanation: </strong>{reveal.explanation || "—"}
              </div>
              {/* Per-player answer timeline */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Player answers</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[...reveal.answers].sort((a, b) => a.response_time_ms - b.response_time_ms).map((a) => (
                    <div key={a.user_id ?? a.name} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                      <span style={{ color: a.correct ? "var(--good)" : "var(--bad)", fontWeight: 700 }}>
                        {a.correct ? "✓" : "✗"}
                      </span>
                      <span>{a.name}</span>
                      <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>
                        {(a.response_time_ms / 1000).toFixed(1)}s
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <VoiceChat
          userId={me?.id ?? null}
          onSendSignaling={handleVoiceSignal}
          incomingSignaling={voiceSignal}
          roomCode={roomCode}
        />
        <ChatPanel
          messages={chatMessages}
          files={sharedFiles}
          onSendMessage={handleSendMessage}
          onShareFile={handleShareFile}
          myUserId={me?.id ?? null}
          playerAvatars={playerAvatarsMap}
        />
      </div>
    );
  }

  // ── Finished ───────────────────────────────────────────────────────────────

  if (gameState === "finished") {
    const winner = finalScores[0];
    return (
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {toast && <AnswerToast text={toast} />}
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
          <div className="card__title">Game Over!</div>
          {winner && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, margin: "12px 0 20px" }}>
              <PlayerAvatar config={winner.avatar} size={72} showLevel level={winner.level} levelTitle={winner.level_title} />
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                👑 {winner.name} — {winner.score} pts
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Lv.{winner.level} {winner.level_title}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {finalScores.map((p, i) => (
              <div key={p.user_id ?? p.name} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ width: 20, fontWeight: 700, color: "var(--text-muted)", textAlign: "center" }}>{i + 1}</div>
                <PlayerAvatar config={p.avatar} size={36} />
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Lv.{p.level} {p.level_title}</div>
                </div>
                <div style={{ fontWeight: 700, color: "var(--accent)" }}>{p.score} pts</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {lastGameId && (
              <button className="btn" onClick={() => loadReplay(lastGameId)}>
                View Replay
              </button>
            )}
            <button className="btn btn--primary" onClick={resetToSetup}>
              Play Again
            </button>
          </div>
        </div>

        <VoiceChat
          userId={me?.id ?? null}
          onSendSignaling={handleVoiceSignal}
          incomingSignaling={voiceSignal}
          roomCode={roomCode}
        />
        <ChatPanel
          messages={chatMessages}
          files={sharedFiles}
          onSendMessage={handleSendMessage}
          onShareFile={handleShareFile}
          myUserId={me?.id ?? null}
          playerAvatars={playerAvatarsMap}
        />
      </div>
    );
  }

  // ── Replay ────────────────────────────────────────────────────────────────

  if (gameState === "replay" && replay) {
    const roundData = replay.rounds[replayRound];
    const questionData = replay.questions.find((q) => q.id === roundData?.question_id);

    return (
      <div style={{ maxWidth: 660, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <button className="btn" onClick={resetToSetup} style={{ fontSize: 11 }}>← Back</button>
          <span style={{ fontWeight: 700 }}>Replay — {replay.code} ({replay.level})</span>
        </div>

        {/* Player scores */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {replay.players.map((p) => (
            <PlayerNameTag
              key={p.user_id ?? p.name}
              name={p.name}
              avatar={p.avatar_config}
              level={p.level}
              score={replayScores[p.name] ?? 0}
              size="sm"
            />
          ))}
        </div>

        {/* Round content */}
        <div className="card" style={{ marginBottom: 12 }}>
          {questionData ? (
            <>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                Round {replayRound + 1} / {replay.rounds.length}
              </div>
              {questionData.passage && (
                <div className="ui-caption" style={{ fontSize: 13, marginBottom: 10, padding: "8px 10px", background: "var(--surface)", borderRadius: 6 }}>
                  {questionData.passage}
                </div>
              )}
              <div style={{ fontWeight: 600, marginBottom: 12 }}>{questionData.text}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {roundData?.answers.map((a) => (
                  <div key={a.user_id ?? a.name} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                    <span style={{ color: a.correct ? "var(--good)" : "var(--bad)", fontWeight: 700, width: 14 }}>
                      {a.correct ? "✓" : "✗"}
                    </span>
                    <span style={{ flex: 1 }}>{a.name}</span>
                    <span style={{ color: "var(--text-muted)" }}>{(a.response_time_ms / 1000).toFixed(1)}s</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="ui-caption" style={{ fontSize: 13 }}>Round data unavailable.</div>
          )}
        </div>

        {/* Playback controls */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn" onClick={() => setReplayRound((r) => Math.max(0, r - 1))} disabled={replayRound === 0}>‹ Prev</button>
          <button
            className="btn btn--primary"
            onClick={() => setReplayPlaying((p) => !p)}
          >
            {replayPlaying ? "⏸ Pause" : "▶ Play"}
          </button>
          <button className="btn" onClick={() => setReplayRound((r) => Math.min(replay.rounds.length - 1, r + 1))} disabled={replayRound >= replay.rounds.length - 1}>Next ›</button>

          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                className={replaySpeed === s ? "btn btn--primary" : "btn"}
                style={{ fontSize: 11, padding: "3px 8px" }}
                onClick={() => setReplaySpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Slider */}
          <input
            type="range"
            min={0}
            max={replay.rounds.length - 1}
            value={replayRound}
            onChange={(e) => { setReplayPlaying(false); setReplayRound(Number(e.target.value)); }}
            style={{ width: "100%", marginTop: 4 }}
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", width: "100%", textAlign: "center" }}>
            Round {replayRound + 1} of {replay.rounds.length}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
