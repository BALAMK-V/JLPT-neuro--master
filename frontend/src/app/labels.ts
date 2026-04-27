import type { LearningType } from "../types";

export type LearningAlias = "balanced" | "quick_reset" | "focus_support" | "calm_structure";

export function learningTypeFromAlias(alias: LearningAlias): LearningType {
  if (alias === "calm_structure") return "calm_structure";
  if (alias === "quick_reset" || alias === "focus_support") return "focus_support";
  return "balanced";
}

export function defaultAliasForType(t: LearningType): LearningAlias {
  if (t === "calm_structure") return "calm_structure";
  if (t === "focus_support") return "focus_support";
  return "balanced";
}

export function learningLabelFromAlias(alias: LearningAlias): string {
  switch (alias) {
    case "balanced":
      return "Balanced";
    case "quick_reset":
      return "Quick Reset";
    case "focus_support":
      return "Focus Support";
    case "calm_structure":
      return "Calm Structure";
  }
}

export function getLearningLabel(learningType: LearningType, uiPrefs?: Record<string, unknown>): string {
  const alias = (uiPrefs as any)?.learning_alias as LearningAlias | undefined;
  return learningLabelFromAlias(alias ?? defaultAliasForType(learningType));
}
