export function ColorPicker({
  value,
  presets,
  warning,
  onChange,
}: {
  value: string;
  presets: string[];
  warning?: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="swatches" aria-label="Color presets">
        {presets.map((color) => (
          <button
            key={color}
            className={value.toLowerCase() === color.toLowerCase() ? "swatch swatch--active" : "swatch"}
            style={{ background: color }}
            onClick={() => onChange(color)}
            aria-label={`Use ${color}`}
          />
        ))}
        <input className="color-input" type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Custom text color" />
      </div>
      {warning ? <div className="notice notice--bad" style={{ marginTop: 10 }}>{warning}</div> : null}
    </div>
  );
}
