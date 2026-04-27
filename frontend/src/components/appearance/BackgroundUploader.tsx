import type { AppearanceSettings, BackgroundType } from "../../types";

export function BackgroundUploader({
  settings,
  onChange,
}: {
  settings: AppearanceSettings;
  onChange: (settings: AppearanceSettings) => void;
}) {
  const value = settings.background_value || {};
  const updateValue = (next: Record<string, unknown>) => onChange({ ...settings, background_value: { ...value, ...next } });

  const loadImage = (file: File) => {
    if (file.size > 1_500_000) {
      alert("Please use an image under 1.5 MB for better performance.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateValue({ url: String(reader.result || ""), name: file.name });
    reader.readAsDataURL(file);
  };

  return (
    <div className="settings-stack">
      <label className="label">
        <span className="label__text">Background type</span>
        <select className="field" value={settings.background_type} onChange={(e) => onChange({ ...settings, background_type: e.target.value as BackgroundType })}>
          <option value="color">Solid color</option>
          <option value="gradient">Gradient</option>
          <option value="image">Image</option>
        </select>
      </label>

      {settings.background_type === "color" ? (
        <label className="label">
          <span className="label__text">Background color</span>
          <input className="field" type="color" value={String(value.color || "#0b1020")} onChange={(e) => updateValue({ color: e.target.value })} />
        </label>
      ) : null}

      {settings.background_type === "gradient" ? (
        <div className="settings-grid">
          <label className="label">
            <span className="label__text">From</span>
            <input className="field" type="color" value={String(value.from || "#0b1020")} onChange={(e) => updateValue({ from: e.target.value })} />
          </label>
          <label className="label">
            <span className="label__text">To</span>
            <input className="field" type="color" value={String(value.to || "#11263f")} onChange={(e) => updateValue({ to: e.target.value })} />
          </label>
        </div>
      ) : null}

      {settings.background_type === "image" ? (
        <>
          <input className="field" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && loadImage(e.target.files[0])} />
          {value.url ? <div className="appearance-image-preview" style={{ backgroundImage: `url("${String(value.url)}")` }} /> : null}
          <label className="label">
            <span className="label__text">Fit</span>
            <select className="field" value={String(value.fit || "cover")} onChange={(e) => updateValue({ fit: e.target.value })}>
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </select>
          </label>
        </>
      ) : null}

      <div className="settings-grid">
        <label className="label">
          <span className="label__text">Blur: {settings.blur_level}px</span>
          <input type="range" min={0} max={24} value={settings.blur_level} onChange={(e) => onChange({ ...settings, blur_level: Number(e.target.value) })} />
        </label>
        <label className="label">
          <span className="label__text">Opacity: {Math.round(settings.opacity * 100)}%</span>
          <input type="range" min={0.15} max={1} step={0.05} value={settings.opacity} onChange={(e) => onChange({ ...settings, opacity: Number(e.target.value) })} />
        </label>
      </div>
    </div>
  );
}
