import React from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, action, className = "" }: SectionHeaderProps) {
  return (
    <div className={`ui-section-head ${className}`}>
      <div className="ui-section-head__text">
        <div className="ui-section-head__title">{title}</div>
        {subtitle && <div className="ui-section-head__subtitle">{subtitle}</div>}
      </div>
      {action && <div className="ui-section-head__action">{action}</div>}
    </div>
  );
}
