import { defaultAliasForType, learningLabelFromAlias, type LearningAlias } from "./labels";
import type { Test, UserProfile } from "../types";

export type LearningStylePlan = {
  alias: LearningAlias;
  label: string;
  sessionMinutes: number;
  reminderMinutes: number;
  defaultQuestionCount: number;
  flashcardLimit: number;
  readingPattern: string;
  listeningSection: string;
  oneCardAtATime: boolean;
  reduceChoiceNoise: boolean;
  showGuidance: boolean;
  testPreference: "standard" | "short" | "guided" | "predictable";
  studyCue: string;
};

function validAlias(raw: unknown): LearningAlias | null {
  return raw === "balanced" || raw === "quick_reset" || raw === "focus_support" || raw === "calm_structure" ? raw : null;
}

export function getLearningAlias(profile?: UserProfile | null): LearningAlias {
  if (!profile) return "balanced";
  return validAlias(profile.ui_prefs?.learning_alias) ?? defaultAliasForType(profile.learning_type);
}

export function getLearningStylePlan(profile?: UserProfile | null): LearningStylePlan {
  const alias = getLearningAlias(profile);
  const sessionMinutes = profile?.session_minutes_preference;
  const reminderMinutes = profile?.reminder_interval_minutes;

  if (alias === "quick_reset") {
    return {
      alias,
      label: learningLabelFromAlias(alias),
      sessionMinutes: sessionMinutes || 8,
      reminderMinutes: reminderMinutes || 15,
      defaultQuestionCount: 8,
      flashcardLimit: 12,
      readingPattern: "short",
      listeningSection: "sokuji",
      oneCardAtATime: true,
      reduceChoiceNoise: false,
      showGuidance: true,
      testPreference: "short",
      studyCue: "Short mission, clear finish line.",
    };
  }

  if (alias === "focus_support") {
    return {
      alias,
      label: learningLabelFromAlias(alias),
      sessionMinutes: sessionMinutes || 10,
      reminderMinutes: reminderMinutes || 18,
      defaultQuestionCount: 12,
      flashcardLimit: 15,
      readingPattern: "medium",
      listeningSection: "point",
      oneCardAtATime: true,
      reduceChoiceNoise: false,
      showGuidance: true,
      testPreference: "guided",
      studyCue: "Use cues, check progress, then reset.",
    };
  }

  if (alias === "calm_structure") {
    return {
      alias,
      label: learningLabelFromAlias(alias),
      sessionMinutes: sessionMinutes || 12,
      reminderMinutes: reminderMinutes || 35,
      defaultQuestionCount: 10,
      flashcardLimit: 10,
      readingPattern: "short",
      listeningSection: "kadai",
      oneCardAtATime: false,
      reduceChoiceNoise: true,
      showGuidance: false,
      testPreference: "predictable",
      studyCue: "Predictable order, fewer moving parts.",
    };
  }

  return {
    alias,
    label: learningLabelFromAlias(alias),
    sessionMinutes: sessionMinutes || 25,
    reminderMinutes: reminderMinutes || 25,
    defaultQuestionCount: 20,
    flashcardLimit: 50,
    readingPattern: "medium",
    listeningSection: "",
    oneCardAtATime: false,
    reduceChoiceNoise: false,
    showGuidance: false,
    testPreference: "standard",
    studyCue: "Mixed practice with normal pacing.",
  };
}

export function formatDuration(seconds: number) {
  if (!seconds) return "Untimed";
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} min`;
}

export function testFitScore(test: Test, plan: LearningStylePlan) {
  const mins = test.duration_seconds ? test.duration_seconds / 60 : 0;
  let score = 0;

  if (test.test_type === "mixed") score += plan.alias === "balanced" ? 3 : 1;
  if (test.test_type !== "mixed") score += plan.alias === "balanced" ? 1 : 2;

  if (plan.testPreference === "short") {
    score += !test.timed ? 4 : 0;
    score += mins > 0 && mins <= plan.sessionMinutes + 4 ? 5 : 0;
  } else if (plan.testPreference === "guided") {
    score += test.timed && mins <= plan.sessionMinutes + 8 ? 4 : 0;
    score += !test.timed ? 2 : 0;
  } else if (plan.testPreference === "predictable") {
    score += test.test_type !== "mixed" ? 4 : 0;
    score += !test.timed || mins <= plan.sessionMinutes + 6 ? 3 : 0;
  } else {
    score += test.timed ? 2 : 1;
    score += test.test_type === "mixed" ? 3 : 0;
  }

  return score;
}
