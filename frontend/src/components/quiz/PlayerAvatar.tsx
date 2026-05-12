import type { AvatarConfig } from "../../types";

const DEFAULT_AVATAR: AvatarConfig = {
  skin_tone: "#f5d0b0",
  hair_style: "short",
  hair_color: "#2c2c2c",
  eye_shape: "round",
  eye_color: "#4a7c59",
  accessory: "none",
};

interface PlayerAvatarProps {
  config?: Partial<AvatarConfig>;
  size?: number;
  showLevel?: boolean;
  level?: number;
  levelTitle?: string;
}

function HairShape({ style, color }: { style: string; color: string }) {
  switch (style) {
    case "long":
      return (
        <>
          <ellipse cx="50" cy="28" rx="22" ry="14" fill={color} />
          <rect x="28" y="34" width="8" height="30" rx="4" fill={color} />
          <rect x="64" y="34" width="8" height="30" rx="4" fill={color} />
        </>
      );
    case "spiky":
      return (
        <path
          d="M28 38 L32 20 L38 32 L44 16 L50 28 L56 16 L62 32 L68 20 L72 38 Z"
          fill={color}
        />
      );
    case "bald":
      return null;
    case "ponytail":
      return (
        <>
          <ellipse cx="50" cy="28" rx="22" ry="12" fill={color} />
          <rect x="66" y="26" width="6" height="20" rx="3" fill={color} />
        </>
      );
    default: // short
      return <ellipse cx="50" cy="27" rx="22" ry="13" fill={color} />;
  }
}

function EyePair({ shape, color }: { shape: string; color: string }) {
  if (shape === "almond") {
    return (
      <>
        <path d="M36 48 Q40 44 44 48 Q40 52 36 48 Z" fill={color} />
        <path d="M56 48 Q60 44 64 48 Q60 52 56 48 Z" fill={color} />
        <circle cx="40" cy="48" r="2.5" fill="#fff" opacity="0.6" />
        <circle cx="60" cy="48" r="2.5" fill="#fff" opacity="0.6" />
      </>
    );
  }
  if (shape === "narrow") {
    return (
      <>
        <rect x="34" y="46" width="12" height="4" rx="2" fill={color} />
        <rect x="54" y="46" width="12" height="4" rx="2" fill={color} />
        <circle cx="40" cy="48" r="2" fill="#fff" opacity="0.5" />
        <circle cx="60" cy="48" r="2" fill="#fff" opacity="0.5" />
      </>
    );
  }
  // round
  return (
    <>
      <circle cx="40" cy="48" r="5" fill={color} />
      <circle cx="60" cy="48" r="5" fill={color} />
      <circle cx="42" cy="46" r="2" fill="#fff" opacity="0.6" />
      <circle cx="62" cy="46" r="2" fill="#fff" opacity="0.6" />
    </>
  );
}

function Accessory({ type }: { type: string }) {
  if (type === "glasses") {
    return (
      <>
        <circle cx="40" cy="48" r="8" fill="none" stroke="#555" strokeWidth="1.5" />
        <circle cx="60" cy="48" r="8" fill="none" stroke="#555" strokeWidth="1.5" />
        <line x1="48" y1="48" x2="52" y2="48" stroke="#555" strokeWidth="1.5" />
        <line x1="32" y1="48" x2="28" y2="46" stroke="#555" strokeWidth="1.5" />
        <line x1="68" y1="48" x2="72" y2="46" stroke="#555" strokeWidth="1.5" />
      </>
    );
  }
  if (type === "hat") {
    return (
      <>
        <rect x="30" y="24" width="40" height="6" rx="2" fill="#333" />
        <rect x="36" y="12" width="28" height="14" rx="4" fill="#333" />
      </>
    );
  }
  if (type === "headband") {
    return <rect x="28" y="32" width="44" height="6" rx="3" fill="#e74c3c" opacity="0.85" />;
  }
  return null;
}

export function PlayerAvatar({ config, size = 48, showLevel, level, levelTitle }: PlayerAvatarProps) {
  const cfg: AvatarConfig = { ...DEFAULT_AVATAR, ...config };

  return (
    <div style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{ borderRadius: "50%", background: "var(--surface, #1a1f35)" }}
      >
        {/* Hair (behind face) */}
        <HairShape style={cfg.hair_style} color={cfg.hair_color} />
        {/* Face */}
        <ellipse cx="50" cy="54" rx="20" ry="24" fill={cfg.skin_tone} />
        {/* Eyes */}
        <EyePair shape={cfg.eye_shape} color={cfg.eye_color} />
        {/* Nose */}
        <circle cx="50" cy="56" r="1.5" fill={cfg.skin_tone} style={{ filter: "brightness(0.8)" }} />
        {/* Mouth */}
        <path d="M44 63 Q50 68 56 63" fill="none" stroke="#c0896a" strokeWidth="2" strokeLinecap="round" />
        {/* Accessory */}
        <Accessory type={cfg.accessory} />
        {/* Ear dots */}
        <circle cx="30" cy="54" r="4" fill={cfg.skin_tone} />
        <circle cx="70" cy="54" r="4" fill={cfg.skin_tone} />
        {/* Shirt */}
        <path d="M30 82 Q50 74 70 82 L72 100 L28 100 Z" fill="var(--accent, #7c5cfc)" opacity="0.7" />
      </svg>
      {showLevel && level !== undefined && (
        <div
          style={{
            position: "absolute",
            bottom: -4,
            right: -4,
            background: "var(--accent, #7c5cfc)",
            color: "#fff",
            borderRadius: 6,
            fontSize: Math.max(8, size * 0.18),
            fontWeight: 700,
            padding: "1px 4px",
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
          }}
        >
          {level}
        </div>
      )}
    </div>
  );
}
