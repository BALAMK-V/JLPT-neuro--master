import React from "react";

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, subtitle, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`ui-empty ${className}`}>
      {icon && <div className="ui-empty__icon">{icon}</div>}
      <div className="ui-empty__title">{title}</div>
      {subtitle && <div className="ui-empty__subtitle">{subtitle}</div>}
      {action && <div className="ui-empty__action">{action}</div>}
    </div>
  );
}
