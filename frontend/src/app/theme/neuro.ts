import type { LearningType } from "../../types";

export function applyNeuroUiMode(learningType: LearningType, uiPrefs?: Record<string, unknown>) {
  const root = document.documentElement;
  root.dataset.learningType = learningType;
  const alias = typeof uiPrefs?.learning_alias === "string" ? uiPrefs.learning_alias : learningType;
  root.dataset.learningAlias = alias;

  if (learningType === "calm_structure" || uiPrefs?.reduced_motion === true) {
    root.classList.add("reduce-motion");
  } else {
    root.classList.remove("reduce-motion");
  }
}
