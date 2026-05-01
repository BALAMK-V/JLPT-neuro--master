import React from "react";

interface DividerProps {
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Divider({ label, className = "", style }: DividerProps) {
  if (label) {
    return (
      <div className={`ui-divider ui-divider--labeled ${className}`} style={style}>
        <span className="ui-divider__label">{label}</span>
      </div>
    );
  }
  return <div className={`ui-divider ${className}`} style={style} />;
}
