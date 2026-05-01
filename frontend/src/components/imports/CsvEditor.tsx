import { useMemo, useState } from "react";
import type { ValidationError } from "./validators";

export function CsvEditor({
  headers,
  rows,
  onChange,
  errors = [],
  maxPreviewRows = 25,
}: {
  headers: string[];
  rows: Array<Record<string, string>>;
  onChange: (rows: Array<Record<string, string>>) => void;
  errors?: ValidationError[];
  maxPreviewRows?: number;
}) {
  const [limit, setLimit] = useState(maxPreviewRows);

  const visible = useMemo(() => rows.slice(0, limit), [rows, limit]);
  const errorRows = useMemo(() => new Set(errors.map((e) => e.rowIndex)), [errors]);

  if (!headers.length) return null;

  return (
    <div className="tablewrap">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 60 }}>#</th>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
            <th style={{ width: 90 }} />
          </tr>
        </thead>
        <tbody>
          {visible.map((r, idx) => (
            <tr key={idx} className={errorRows.has(idx) ? "tr--error" : undefined}>
              <td style={{ color: "rgba(255,255,255,0.65)" }}>{idx + 1}</td>
              {headers.map((h) => (
                <td key={h}>
                  <input
                    className="field field--sm"
                    value={r[h] ?? ""}
                    onChange={(e) => {
                      const copy = rows.slice();
                      copy[idx] = { ...copy[idx], [h]: e.target.value };
                      onChange(copy);
                    }}
                  />
                </td>
              ))}
              <td>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    const copy = rows.slice();
                    copy.splice(idx, 1);
                    onChange(copy);
                  }}
                  style={{ padding: "8px 10px" }}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="tablefooter">
        <div style={{ color: "rgba(255,255,255,0.65)" }}>
          Previewing {Math.min(rows.length, limit)} of {rows.length} rows
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {limit < rows.length ? (
            <button className="btn" type="button" onClick={() => setLimit((v) => Math.min(rows.length, v + maxPreviewRows))}>
              Show more
            </button>
          ) : null}
          {rows.length > maxPreviewRows ? (
            <button className="btn" type="button" onClick={() => setLimit(maxPreviewRows)}>
              Collapse
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
