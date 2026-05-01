import React from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "accent" | "management" | "muted";

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function Badge({ variant = "default", className = "", style, children }: BadgeProps) {
  return (
    <span className={`badge badge--${variant} ${className}`} style={style}>
      {children}
    </span>
  );
}
