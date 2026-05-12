import { useCallback, useEffect, useRef, useState } from "react";
import { PlayerAvatar } from "./PlayerAvatar";
import type { AvatarConfig } from "../../types";

interface ChatMessage {
  user_id: number | null;
  name: string;
  text: string;
  ts: number;
}

interface SharedFile {
  user_id: number | null;
  name: string;
  filename: string;
  file_url: string;
  file_type: string;
  ts: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  files: SharedFile[];
  onSendMessage: (text: string) => void;
  onShareFile: (file: File) => void;
  myUserId: number | null;
  playerAvatars: Record<string, Partial<AvatarConfig>>;
}

export function ChatPanel({
  messages,
  files,
  onSendMessage,
  onShareFile,
  myUserId,
  playerAvatars,
}: ChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [tab, setTab] = useState<"chat" | "files">("chat");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, files]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    onSendMessage(text);
    setInput("");
  }, [input, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onShareFile(file);
        e.target.value = "";
      }
    },
    [onShareFile]
  );

  const isImage = (url: string) => /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(url);
  const isAudio = (url: string) => /\.(mp3|wav|ogg|m4a|webm)$/i.test(url);

  const MAX_CHARS = 500;

  return (
    <>
      {/* Toggle button */}
      <button
        className="btn"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 1000,
          borderRadius: 30,
          padding: "10px 16px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
          background: open ? "var(--bad)" : "var(--accent)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontSize: 14,
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        {open ? "✕" : `💬 ${messages.length}`}
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 70,
            right: 20,
            width: 340,
            maxHeight: "60vh",
            background: "var(--card-bg, #111624)",
            border: "1px solid var(--border, #2a2f45)",
            borderRadius: 14,
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <button
              className="btn"
              style={{
                flex: 1,
                borderRadius: 0,
                fontSize: 12,
                background: tab === "chat" ? "var(--surface)" : "transparent",
                border: "none",
                cursor: "pointer",
                padding: "8px 0",
              }}
              onClick={() => setTab("chat")}
            >
              Chat ({messages.length})
            </button>
            <button
              className="btn"
              style={{
                flex: 1,
                borderRadius: 0,
                fontSize: 12,
                background: tab === "files" ? "var(--surface)" : "transparent",
                border: "none",
                cursor: "pointer",
                padding: "8px 0",
              }}
              onClick={() => setTab("files")}
            >
              Files ({files.length})
            </button>
          </div>

          {/* Chat tab */}
          {tab === "chat" && (
            <>
              <div
                ref={listRef}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {messages.length === 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      textAlign: "center",
                      padding: 20,
                    }}
                  >
                    No messages yet. Say hello!
                  </div>
                )}
                {messages.map((m, i) => {
                  const isMe = m.user_id != null && m.user_id === myUserId;
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                        flexDirection: isMe ? "row-reverse" : "row",
                      }}
                    >
                      <PlayerAvatar
                        config={playerAvatars[m.name] || playerAvatars[m.user_id?.toString() || ""]}
                        size={28}
                      />
                      <div
                        style={{
                          maxWidth: "75%",
                          background: isMe ? "var(--accent)" : "var(--surface)",
                          borderRadius: 10,
                          padding: "6px 10px",
                          fontSize: 13,
                          lineHeight: 1.4,
                          wordBreak: "break-word",
                        }}
                      >
                        {!isMe && (
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "var(--text-muted)",
                              marginBottom: 2,
                            }}
                          >
                            {m.name}
                          </div>
                        )}
                        <div>{m.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 6,
                  padding: "8px 10px",
                  borderTop: "1px solid var(--border)",
                  flexShrink: 0,
                }}
              >
                <label
                  style={{
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 4px",
                  }}
                  title="Share file"
                >
                  📎
                  <input
                    type="file"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                    accept="image/*,.pdf,.zip,.csv,.json,.xlsx,.txt,.mp3,.wav,.ogg"
                  />
                </label>
                <input
                  className="field"
                  style={{ flex: 1, fontSize: 13, padding: "6px 10px" }}
                  placeholder={`Message (max ${MAX_CHARS})`}
                  value={input}
                  maxLength={MAX_CHARS}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  className="btn btn--primary"
                  style={{ fontSize: 12, padding: "4px 12px" }}
                  onClick={handleSend}
                  disabled={!input.trim()}
                >
                  Send
                </button>
              </div>
            </>
          )}

          {/* Files tab */}
          {tab === "files" && (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "8px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {files.length === 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    textAlign: "center",
                    padding: 20,
                  }}
                >
                  No shared files yet.
                </div>
              )}
              {[...files].reverse().map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    background: "var(--surface)",
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  <PlayerAvatar
                    config={playerAvatars[f.name] || playerAvatars[f.user_id?.toString() || ""]}
                    size={24}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                      {f.name}
                    </div>
                    {isImage(f.file_url) ? (
                      <a href={f.file_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={f.file_url}
                          alt={f.filename}
                          style={{
                            maxWidth: "100%",
                            maxHeight: 160,
                            borderRadius: 6,
                            cursor: "pointer",
                            objectFit: "cover",
                          }}
                        />
                      </a>
                    ) : isAudio(f.file_url) ? (
                      <audio controls src={f.file_url} style={{ width: "100%" }} />
                    ) : (
                      <a
                        href={f.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 12,
                          color: "var(--accent)",
                          textDecoration: "underline",
                          wordBreak: "break-all",
                        }}
                      >
                        📄 {f.filename}
                      </a>
                    )}
                  </div>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: 4,
                }}
              >
                <label
                  className="btn"
                  style={{ fontSize: 11, cursor: "pointer" }}
                >
                  📎 Upload file
                  <input
                    type="file"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
