import type { AvatarConfig } from "../../types";
import { PlayerAvatar } from "./PlayerAvatar";

interface PlayerNameTagProps {
  name: string;
  avatar?: Partial<AvatarConfig>;
  level?: number;
  levelTitle?: string;
  score?: number;
  streak?: number;
  answered?: boolean;
  size?: "sm" | "md";
}

export function PlayerNameTag({
  name,
  avatar,
  level,
  levelTitle,
  score,
  streak,
  answered,
  size = "md",
}: PlayerNameTagProps) {
  const avatarSize = size === "sm" ? 32 : 40;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: size === "sm" ? 6 : 8,
        padding: size === "sm" ? "4px 8px" : "6px 10px",
        background: "var(--surface)",
        borderRadius: 10,
        border: answered ? "1px solid var(--accent)" : "1px solid var(--border)",
        transition: "border-color 0.2s",
        minWidth: 0,
        position: "relative",
      }}
    >
      <PlayerAvatar config={avatar} size={avatarSize} showLevel={!!level} level={level} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: size === "sm" ? 12 : 13,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </div>
        {levelTitle && (
          <div style={{ fontSize: 10, color: "var(--text-muted, #8890aa)", lineHeight: 1.2 }}>
            Lv.{level} {levelTitle}
          </div>
        )}
      </div>
      {score !== undefined && (
        <div
          style={{
            marginLeft: "auto",
            fontWeight: 700,
            fontSize: 13,
            color: "var(--accent)",
            whiteSpace: "nowrap",
          }}
        >
          {score}
        </div>
      )}
      {streak !== undefined && streak >= 2 && (
        <div
          style={{
            position: "absolute",
            top: -6,
            right: -4,
            background: "#f39c12",
            color: "#fff",
            borderRadius: 8,
            fontSize: 9,
            fontWeight: 700,
            padding: "1px 4px",
          }}
        >
          🔥{streak}
        </div>
      )}
    </div>
  );
}
