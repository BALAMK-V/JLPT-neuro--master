export function AppLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="app-logo"
      aria-hidden="true"
    >
      {/* Outer octagon */}
      <polygon
        points="24,3 40,10 45,24 40,39 24,45 8,39 3,24 8,10"
        fill="rgba(204,26,26,0.12)"
        stroke="#cc1a1a"
        strokeWidth="1.6"
      />
      {/* Left & right tick marks */}
      <line x1="3" y1="21" x2="3" y2="27" stroke="#cc1a1a" strokeWidth="2" strokeLinecap="round" opacity="0.85"/>
      <line x1="45" y1="21" x2="45" y2="27" stroke="#cc1a1a" strokeWidth="2" strokeLinecap="round" opacity="0.85"/>
      {/* Top & bottom horizontal accent lines */}
      <line x1="12" y1="17" x2="36" y2="17" stroke="#cc1a1a" strokeWidth="0.55" opacity="0.5"/>
      <line x1="12" y1="31" x2="36" y2="31" stroke="#cc1a1a" strokeWidth="0.55" opacity="0.5"/>
      {/* Inner corner marks */}
      <line x1="8" y1="10" x2="12" y2="14" stroke="#cc1a1a" strokeWidth="0.6" opacity="0.35"/>
      <line x1="40" y1="10" x2="36" y2="14" stroke="#cc1a1a" strokeWidth="0.6" opacity="0.35"/>
      <line x1="8" y1="39" x2="12" y2="35" stroke="#cc1a1a" strokeWidth="0.6" opacity="0.35"/>
      <line x1="40" y1="39" x2="36" y2="35" stroke="#cc1a1a" strokeWidth="0.6" opacity="0.35"/>
      {/* Central kanji 語 — "language / words" */}
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fill="#cc1a1a"
        fontSize="16"
        fontFamily="Georgia,'Times New Roman',serif"
        fontWeight="900"
      >語</text>
    </svg>
  );
}
