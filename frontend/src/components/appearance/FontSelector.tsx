import { CustomSelect } from "../ui";
import type { FontFamily, FontSize, FontWeight } from "../../types";

export function FontSelector({
  family,
  size,
  weight,
  onFamily,
  onSize,
  onWeight,
}: {
  family: FontFamily;
  size: FontSize;
  weight: FontWeight;
  onFamily: (value: FontFamily) => void;
  onSize: (value: FontSize) => void;
  onWeight: (value: FontWeight) => void;
}) {
  return (
    <div className="settings-grid">
      <label className="label">
        <span className="label__text">Font family</span>
        <CustomSelect value={family} onChange={(e) => onFamily(e.target.value as FontFamily)}>
          <option value="sans">Sans</option>
          <option value="serif">Serif</option>
          <option value="rounded">Rounded</option>
          <option value="mono">Mono</option>
        </CustomSelect>
      </label>
      <label className="label">
        <span className="label__text">Font size</span>
        <CustomSelect value={size} onChange={(e) => onSize(e.target.value as FontSize)}>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </CustomSelect>
      </label>
      <label className="label">
        <span className="label__text">Font weight</span>
        <CustomSelect value={weight} onChange={(e) => onWeight(e.target.value as FontWeight)}>
          <option value="light">Light</option>
          <option value="normal">Normal</option>
          <option value="bold">Bold</option>
        </CustomSelect>
      </label>
    </div>
  );
}
