import React, { useEffect } from "react";

interface ModalProps {
  title?: string;
  onClose?: () => void;
  footer?: React.ReactNode;
  maxWidth?: number;
  children: React.ReactNode;
}

export function Modal({ title, onClose, footer, maxWidth = 480, children }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ui-modal-overlay" onClick={onClose}>
      <div
        className="ui-modal"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="ui-modal__header">
            <span className="ui-modal__title">{title}</span>
            {onClose && (
              <button className="ui-modal__close btn" onClick={onClose} aria-label="Close">
                ✕
              </button>
            )}
          </div>
        )}
        <div className="ui-modal__body">{children}</div>
        {footer && <div className="ui-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
