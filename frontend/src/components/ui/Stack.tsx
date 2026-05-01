import React from "react";

interface StackProps {
  gap?: number;
  align?: React.CSSProperties["alignItems"];
  justify?: React.CSSProperties["justifyContent"];
  wrap?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function VStack({ gap = 12, align, justify, className = "", style, children }: StackProps) {
  return (
    <div
      className={className}
      style={{ display: "flex", flexDirection: "column", gap, alignItems: align, justifyContent: justify, ...style }}
    >
      {children}
    </div>
  );
}

export function HStack({ gap = 10, align = "center", justify, wrap, className = "", style, children }: StackProps) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "row",
        gap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? "wrap" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
