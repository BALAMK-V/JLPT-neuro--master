import React from "react";

interface FormFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ label, hint, error, required, className = "", children }: FormFieldProps) {
  return (
    <div className={`ui-form-field ${className}`}>
      {label && (
        <div className="ui-form-field__label">
          {label}
          {required && <span className="ui-form-field__required"> *</span>}
        </div>
      )}
      {children}
      {hint && !error && <div className="ui-form-field__hint">{hint}</div>}
      {error && <div className="ui-form-field__error">{error}</div>}
    </div>
  );
}
