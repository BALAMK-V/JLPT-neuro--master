import { useRef, useState } from "react";

export function AudioPlayer({ src, onEnded }: { src: string; onEnded?: () => void }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [ready, setReady] = useState(false);

  return (
    <div className="card" style={{ gridColumn: "span 12" }}>
      <div className="card__title">Listening</div>
      <audio
        ref={ref}
        src={src}
        controls
        onCanPlay={() => setReady(true)}
        onEnded={() => onEnded?.()}
        style={{ width: "100%" }}
      />
      <div style={{ marginTop: 8, color: "rgba(255,255,255,0.65)" }}>{ready ? "" : "Loading audio…"}</div>
    </div>
  );
}
