import React from "react";

type NoticeStatus = "ok" | "bad" | "warn" | "info";

interface NoticeProps {
  status?: NoticeStatus;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function Notice({ status, className = "", style, children }: NoticeProps) {
  const cls = status ? `notice notice--${status}` : "notice";
  return (
    <div className={`${cls} ${className}`} style={style}>
      {children}
    </div>
  );
}
