import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  autoPlay?: boolean;
  playCount?: number; // max number of plays allowed (JLPT listening: usually 2)
}

export function ExamAudioPlayer({ src, autoPlay = false, playCount = 2 }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [plays, setPlays] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setProgress(0); };
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);

    if (autoPlay && plays === 0) {
      audio.play().catch(() => {});
    }

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [src]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      if (plays >= playCount) return;
      setPlays((p) => p + 1);
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  }

  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const exhausted = plays >= playCount;

  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  return (
    <div className="exam-audio">
      <audio ref={audioRef} src={src} preload="auto" />
      <button
        className={`exam-audio__btn ${exhausted && !playing ? "exam-audio__btn--disabled" : ""}`}
        onClick={toggle}
        disabled={exhausted && !playing}
        aria-label={playing ? "Pause audio" : "Play audio"}
      >
        {playing ? "⏸ Pause" : "▶ Play"}
      </button>
      <div className="exam-audio__track">
        <div className="exam-audio__progress" style={{ width: `${pct}%` }} />
      </div>
      <div className="exam-audio__meta">
        <span>{formatTime(progress)}</span>
        <span>{formatTime(duration)}</span>
        <span className={`exam-audio__plays ${exhausted ? "exam-audio__plays--exhausted" : ""}`}>
          {plays}/{playCount} plays
        </span>
      </div>
    </div>
  );
}
