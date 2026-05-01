import React from "react";

type As = "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div" | "label";

interface TextProps {
  as?: As;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function Heading({ as: Tag = "h2", className = "", style, children }: TextProps) {
  return (
    <Tag className={`ui-heading ${className}`} style={style}>
      {children}
    </Tag>
  );
}

export function Label({ as: Tag = "div", className = "", style, children }: TextProps) {
  return (
    <Tag className={`ui-label ${className}`} style={style}>
      {children}
    </Tag>
  );
}

export function Caption({ as: Tag = "div", className = "", style, children }: TextProps) {
  return (
    <Tag className={`ui-caption ${className}`} style={style}>
      {children}
    </Tag>
  );
}

export function Meta({ as: Tag = "div", className = "", style, children }: TextProps) {
  return (
    <Tag className={`ui-meta ${className}`} style={style}>
      {children}
    </Tag>
  );
}
