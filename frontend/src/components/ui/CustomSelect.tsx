import React, { useEffect, useRef, useState } from "react";

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  size?: "sm";
  placeholder?: string;
}

function parseOptions(children: React.ReactNode): Option[] {
  return React.Children.toArray(children)
    .filter((c): c is React.ReactElement => React.isValidElement(c))
    .map((c) => ({
      value: String(c.props.value ?? ""),
      label: c.props.children != null ? String(c.props.children) : String(c.props.value ?? ""),
      disabled: Boolean(c.props.disabled),
    }));
}

export function CustomSelect({
  value,
  onChange,
  children,
  className,
  style,
  size,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusIdx, setFocusIdx] = useState(-1);

  const options = parseOptions(children);
  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Scroll focused option into view
  useEffect(() => {
    if (!open || focusIdx < 0 || !menuRef.current) return;
    const el = menuRef.current.children[focusIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [focusIdx, open]);

  const select = (opt: Option) => {
    if (opt.disabled) return;
    const synth = { target: { value: opt.value } } as React.ChangeEvent<HTMLSelectElement>;
    onChange(synth);
    setOpen(false);
    setFocusIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setFocusIdx(options.findIndex((o) => o.value === value));
      }
      return;
    }
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (focusIdx >= 0) select(options[focusIdx]);
    }
  };

  const smClass = size === "sm" ? " cselect--sm" : "";
  const outerClass = ["cselect", smClass, open ? "cselect--open" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={wrapRef} className={outerClass} style={style}>
      <button
        type="button"
        className="cselect__trigger"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setFocusIdx(options.findIndex((o) => o.value === value));
        }}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="cselect__value">{selected?.label ?? ""}</span>
        <svg
          className="cselect__chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div ref={menuRef} className="cselect__menu" role="listbox">
          {options.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              disabled={opt.disabled}
              className={[
                "cselect__opt",
                opt.value === value ? "cselect__opt--selected" : "",
                i === focusIdx ? "cselect__opt--focused" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onMouseEnter={() => setFocusIdx(i)}
              onClick={() => select(opt)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
