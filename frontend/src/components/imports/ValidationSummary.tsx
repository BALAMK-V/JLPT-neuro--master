import { useMemo } from "react";
import type { ValidationError } from "./validators";

export function ValidationSummary({ errors }: { errors: ValidationError[] }) {
  const top = useMemo(() => errors.slice(0, 10), [errors]);

  if (!errors.length) {
    return <div className="notice notice--ok">Looks good. No validation errors found.</div>;
  }

  const headerErrors = errors.filter((e) => e.rowIndex === -1);
  const rowErrors = errors.filter((e) => e.rowIndex >= 0);

  return (
    <div className="notice notice--bad">
      <div style={{ fontWeight: 900, marginBottom: 6 }}>Validation issues</div>
      {headerErrors.map((e, i) => (
        <div key={i}>{e.message}</div>
      ))}
      {rowErrors.length ? (
        <div style={{ marginTop: 8, color: "rgba(255,255,255,0.85)" }}>
          Showing {top.length} of {errors.length} issues:
          <ul className="list" style={{ marginTop: 6 }}>
            {top.map((e, i) => (
              <li key={i}>
                Row {e.rowIndex + 2}
                {e.field ? ` • ${e.field}` : ""}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
