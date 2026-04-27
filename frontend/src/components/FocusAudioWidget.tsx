import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../app/api/client";
import { useMe } from "../app/state/user";
import { useBrownNoise } from "./focus/useBrownNoise";
import type { Me } from "../types";

type FocusTrack = { id: string; title: string; url: string };
type FocusAlbum = { id: string; name: string; tracks: FocusTrack[] };

type FocusPrefs = {
  volume: number; // 0..1
  loop: boolean;
  mode: "brown" | "track";
  activeAlbumId: string | null;
  activeTrackId: string | null;
  scheduleEnabled: boolean;
  scheduleStart: string; // HH:MM
  scheduleEnd: string; // HH:MM
  albums: FocusAlbum[];
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function clamp01(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function parseTimeToMinutes(hhmm: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function isWithinSchedule(now: Date, start: string, end: string) {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s == null || e == null) return true;
  const n = now.getHours() * 60 + now.getMinutes();
  if (s === e) return true;
  if (s < e) return n >= s && n < e;
  // crosses midnight
  return n >= s || n < e;
}

const DEFAULT_PREFS: FocusPrefs = {
  volume: 0.35,
  loop: true,
  mode: "brown",
  activeAlbumId: null,
  activeTrackId: null,
  scheduleEnabled: false,
  scheduleStart: "09:00",
  scheduleEnd: "17:00",
  albums: [
    {
      id: "default",
      name: "Brown noise",
      tracks: [],
    },
  ],
};

function readPrefs(uiPrefs: Record<string, any> | null | undefined): FocusPrefs {
  const raw = uiPrefs?.focus_audio;
  if (!raw || typeof raw !== "object") return DEFAULT_PREFS;
  return {
    ...DEFAULT_PREFS,
    ...raw,
    volume: clamp01(Number(raw.volume ?? DEFAULT_PREFS.volume)),
    loop: Boolean(raw.loop ?? DEFAULT_PREFS.loop),
    mode: raw.mode === "track" ? "track" : "brown",
    scheduleEnabled: Boolean(raw.scheduleEnabled ?? false),
    scheduleStart: typeof raw.scheduleStart === "string" ? raw.scheduleStart : DEFAULT_PREFS.scheduleStart,
    scheduleEnd: typeof raw.scheduleEnd === "string" ? raw.scheduleEnd : DEFAULT_PREFS.scheduleEnd,
    albums: Array.isArray(raw.albums) ? raw.albums : DEFAULT_PREFS.albums,
    activeAlbumId: raw.activeAlbumId ?? null,
    activeTrackId: raw.activeTrackId ?? null,
  };
}

export function FocusAudioWidget() {
  const { me, refresh } = useMe();
  const noise = useBrownNoise(0.35);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usesFocusSupport = me?.profile.learning_type === "focus_support";
  const prefs = useMemo(() => readPrefs(me?.profile.ui_prefs), [me?.profile.ui_prefs]);
  const [local, setLocal] = useState<FocusPrefs>(prefs);

  // Keep local state in sync with profile changes
  useEffect(() => setLocal(prefs), [prefs]);

  const activeTrack = useMemo(() => {
    const album = local.albums.find((a) => a.id === local.activeAlbumId) ?? null;
    const track =
      album?.tracks.find((t) => t.id === local.activeTrackId) ??
      local.albums.flatMap((a) => a.tracks).find((t) => t.id === local.activeTrackId) ??
      null;
    return track;
  }, [local.activeAlbumId, local.activeTrackId, local.albums]);

  const playing = noise.playing || Boolean(audioRef.current && !audioRef.current.paused);

  const applyVolume = (v: number) => {
    noise.setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  useEffect(() => {
    applyVolume(local.volume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.volume]);

  const stopAll = () => {
    noise.stop();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const play = async () => {
    stopAll();
    if (local.mode === "brown") {
      await noise.start();
      noise.setVolume(local.volume);
      return;
    }
    if (local.mode === "track" && activeTrack?.url) {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = activeTrack.url;
      audioRef.current.loop = Boolean(local.loop);
      audioRef.current.volume = local.volume;
      await audioRef.current.play();
    }
  };

  const togglePlay = async () => {
    try {
      setError(null);
      if (playing) stopAll();
      else await play();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  };

  const savePrefs = async (next: FocusPrefs) => {
    if (!me) return;
    setSaving(true);
    setError(null);
    try {
      const ui_prefs = { ...(me.profile.ui_prefs || {}), focus_audio: next };
      await api<Me>("/auth/me/", "PATCH", { profile: { ui_prefs } });
      await refresh();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  // Schedule auto-play/pause
  useEffect(() => {
    if (!usesFocusSupport) return;
    if (!local.scheduleEnabled) return;

    const tick = async () => {
      const ok = isWithinSchedule(new Date(), local.scheduleStart, local.scheduleEnd);
      if (ok && !playing) {
        try {
          await play();
        } catch {
          // ignore autoplay errors; user gesture may be needed
        }
      }
      if (!ok && playing) stopAll();
    };

    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usesFocusSupport, local.scheduleEnabled, local.scheduleStart, local.scheduleEnd, local.mode, local.activeTrackId, local.loop, local.volume]);

  if (!usesFocusSupport) return null;

  return (
    <>
      <button className={playing ? "focusaudio focusaudio--playing" : "focusaudio"} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Focus {playing ? "• On" : ""}
      </button>

      {open ? (
        <div className="focusaudio__panel" role="dialog" aria-label="Focus audio">
          <div className="focusaudio__title">
            <div style={{ fontWeight: 900 }}>Focus audio</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {saving ? <span className="pill">saving...</span> : <span className="pill">Focus mode</span>}
              <button className="btn" onClick={() => setOpen(false)} style={{ padding: "6px 10px" }}>
                Close
              </button>
            </div>
          </div>

          <div className="toolbar" style={{ marginTop: 10 }}>
            <button className="btn btn--primary" onClick={() => togglePlay()}>
              {playing ? "Pause" : "Play"}
            </button>

            <select
              className="field field--sm"
              value={local.mode}
              onChange={(e) => {
                const next = { ...local, mode: e.target.value === "track" ? "track" : "brown" } as FocusPrefs;
                setLocal(next);
                savePrefs(next);
              }}
              style={{ maxWidth: 190 }}
            >
              <option value="brown">Brown noise</option>
              <option value="track">Album track</option>
            </select>

            <label className="pill" style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px" }}>
              Vol
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={local.volume}
                onChange={(e) => {
                  const v = clamp01(Number(e.target.value));
                  const next = { ...local, volume: v };
                  setLocal(next);
                  applyVolume(v);
                }}
                onMouseUp={() => savePrefs(local)}
                onTouchEnd={() => savePrefs(local)}
                style={{ width: 110 }}
              />
            </label>

            <label className="pill" style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px" }}>
              <input
                type="checkbox"
                checked={local.loop}
                onChange={(e) => {
                  const next = { ...local, loop: e.target.checked };
                  setLocal(next);
                  if (audioRef.current) audioRef.current.loop = e.target.checked;
                  savePrefs(next);
                }}
              />
              Loop
            </label>
          </div>

          {local.mode === "track" ? (
            <div className="card" style={{ gridColumn: "span 12", marginTop: 10, boxShadow: "none" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>Library</div>
                <span className="pill">{activeTrack ? `Now: ${activeTrack.title}` : "No track selected"}</span>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <select
                  className="field field--sm"
                  value={local.activeAlbumId ?? ""}
                  onChange={(e) => {
                    const albumId = e.target.value || null;
                    const firstTrack = local.albums.find((a) => a.id === albumId)?.tracks?.[0] ?? null;
                    const next = { ...local, activeAlbumId: albumId, activeTrackId: firstTrack?.id ?? null };
                    setLocal(next);
                    savePrefs(next);
                  }}
                >
                  <option value="">Select album</option>
                  {local.albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>

                <select
                  className="field field--sm"
                  value={local.activeTrackId ?? ""}
                  onChange={(e) => {
                    const next = { ...local, activeTrackId: e.target.value || null };
                    setLocal(next);
                    savePrefs(next);
                  }}
                  disabled={!local.albums.some((a) => a.id === local.activeAlbumId && a.tracks.length)}
                >
                  <option value="">Select track</option>
                  {(local.albums.find((a) => a.id === local.activeAlbumId)?.tracks ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>

                <AddTrackForm
                  onAdd={(title, url) => {
                    const albumId = local.activeAlbumId ?? local.albums[0]?.id ?? "default";
                    const track: FocusTrack = { id: uid("track"), title, url };
                    const nextAlbums = local.albums.map((a) => (a.id === albumId ? { ...a, tracks: [...a.tracks, track] } : a));
                    const next = { ...local, albums: nextAlbums, activeAlbumId: albumId, activeTrackId: track.id, mode: "track" as const };
                    setLocal(next);
                    savePrefs(next);
                  }}
                  onAddAlbum={(name) => {
                    const album: FocusAlbum = { id: uid("album"), name, tracks: [] };
                    const next = { ...local, albums: [...local.albums, album], activeAlbumId: album.id };
                    setLocal(next);
                    savePrefs(next);
                  }}
                />
              </div>
            </div>
          ) : null}

          <div className="card" style={{ gridColumn: "span 12", marginTop: 10, boxShadow: "none" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>Schedule</div>
              <span className="pill">Auto play/pause</span>
            </div>

            <div className="toolbar" style={{ marginTop: 10 }}>
              <label className="pill" style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px" }}>
                <input
                  type="checkbox"
                  checked={local.scheduleEnabled}
                  onChange={(e) => {
                    const next = { ...local, scheduleEnabled: e.target.checked };
                    setLocal(next);
                    savePrefs(next);
                  }}
                />
                Enabled
              </label>

              <input
                className="field field--sm"
                type="time"
                value={local.scheduleStart}
                onChange={(e) => setLocal((s) => ({ ...s, scheduleStart: e.target.value }))}
                onBlur={() => savePrefs(local)}
                style={{ maxWidth: 140 }}
              />
              <span className="pill">to</span>
              <input
                className="field field--sm"
                type="time"
                value={local.scheduleEnd}
                onChange={(e) => setLocal((s) => ({ ...s, scheduleEnd: e.target.value }))}
                onBlur={() => savePrefs(local)}
                style={{ maxWidth: 140 }}
              />
            </div>
          </div>

          {error ? <div className="error" style={{ marginTop: 10 }}>{error}</div> : null}
          <div style={{ marginTop: 10, color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
            Note: Browsers may block autoplay until you press Play once.
          </div>
        </div>
      ) : null}
    </>
  );
}

function AddTrackForm({
  onAdd,
  onAddAlbum,
}: {
  onAdd: (title: string, url: string) => void;
  onAddAlbum: (name: string) => void;
}) {
  const [albumName, setAlbumName] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="field field--sm" placeholder="New album name" value={albumName} onChange={(e) => setAlbumName(e.target.value)} />
        <button
          className="btn"
          type="button"
          onClick={() => {
            const n = albumName.trim();
            if (!n) return;
            onAddAlbum(n);
            setAlbumName("");
          }}
        >
          Add album
        </button>
      </div>

      <input className="field field--sm" placeholder="Track title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className="field field--sm" placeholder="Track URL (mp3/wav/ogg)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <button
        className="btn"
        type="button"
        onClick={() => {
          const t = title.trim();
          const u = url.trim();
          if (!t || !u) return;
          onAdd(t, u);
          setTitle("");
          setUrl("");
        }}
      >
        Add track
      </button>
    </div>
  );
}
