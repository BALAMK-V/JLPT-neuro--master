export type LearningType = "balanced" | "focus_support" | "calm_structure";

export type NeuroResultType =
  | "balanced"
  | "quick_reset"
  | "focus_support"
  | "momentum_support"
  | "calm_structure";

export type NeuroTraitScores = {
  focus: number;
  attention_span: number;
  memory_retention: number;
  distraction: number;
  consistency: number;
  sensory_preference: number;
  structure: number;
};

export type NeuroOption = {
  id: number;
  text: string;
  value: number;
  weight_mapping: Partial<Record<keyof NeuroTraitScores, number>>;
  order: number;
};

export type NeuroQuestion = {
  id: number;
  question_text: string;
  type: "scale" | "mcq";
  order: number;
  trait_key: keyof NeuroTraitScores;
  options: NeuroOption[];
};

export type NeuroProfileResult = {
  result_type: NeuroResultType;
  trait_scores: NeuroTraitScores;
  summary: {
    title: string;
    explanation: string;
    strengths: string[];
    weaknesses: string[];
    recommended_learning_style: string;
    trait_scores: NeuroTraitScores;
  };
  created_at: string;
  updated_at: string;
  days_since_assessment?: number;
};

export type UserProfile = {
  learning_type: LearningType;
  jlpt_level: "N5" | "N4" | "N3" | "N2" | "N1";
  daily_goal_new_items: number;
  session_minutes_preference: number;
  reminders_enabled: boolean;
  reminder_interval_minutes: number;
  ui_prefs: Record<string, unknown>;
};

export type Me = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  profile: UserProfile;
};

export type ThemeMode = "light" | "dark" | "auto";
export type FontFamily = "sans" | "serif" | "rounded" | "mono";
export type FontSize = "small" | "medium" | "large";
export type FontWeight = "light" | "normal" | "bold";
export type BackgroundType = "color" | "gradient" | "image";
export type AnimationLevel = "low" | "normal" | "high";
export type LayoutDensity = "compact" | "comfortable" | "spacious";

export type AppearanceSettings = {
  theme_mode: ThemeMode;
  font_family: FontFamily;
  font_size: FontSize;
  font_weight: FontWeight;
  font_color: string;
  background_type: BackgroundType;
  background_value: Record<string, unknown>;
  blur_level: number;
  opacity: number;
  border_radius: number;
  shadow_level: number;
  animation_level: AnimationLevel;
  layout_density: LayoutDensity;
  updated_at?: string;
};

export type StudyCompanionSettings = {
  character_type: "daruma" | "maneki" | "kitsune" | "tanuki";
  enabled: boolean;
  position: { x?: number; y?: number; corner?: string };
  sound_enabled: boolean;
  updated_at?: string;
};

export type Note = {
  id: number;
  note_type: "quick" | "context" | "session";
  reference_type: string;
  reference_id: number | null;
  content: string;
  created_at: string;
  updated_at: string;
};

export type Dashboard = {
  avg_accuracy: number;
  due_reviews: number;
  flash_due_count: number;
  weak_areas: Array<{ item_type: string; avg: number; count: number }>;
  streak_days: number;
  minutes_spent_today: number;
  top_unknown_words: Array<{ id: number; word: string; reading: string; meaning_en: string; frequency_rank: number }>;
  recommendations: Array<Record<string, unknown>>;
};

export type Kanji = {
  id: number;
  character: string;
  onyomi: string;
  kunyomi: string;
  meaning_en: string;
  jlpt_level: "N5" | "N4" | "N3" | "N2" | "N1";
  examples?: Array<{ id: number; sentence_jp: string; sentence_en: string }>;
};

export type Vocab = {
  id: number;
  word: string;
  reading: string;
  meaning_en: string;
  jlpt_level: "N5" | "N4" | "N3" | "N2" | "N1";
  frequency_rank?: number | null;
  related_kanji_ids?: number[];
};

export type ListeningQuestion = {
  id: number;
  audio_file: string | null;
  audio_filename: string;
  section: string;
  question_type: string;
  audio_text: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: string;
  explanation: string;
  jlpt_level: "N5" | "N4" | "N3" | "N2" | "N1";
  created_at: string;
};

export type Test = {
  id: number;
  title: string;
  test_type: string;
  jlpt_level: string;
  timed: boolean;
  duration_seconds: number;
  is_published: boolean;
  created_at: string;
  questions: TestQuestion[];
};

export type TestQuestion = {
  id: number;
  test: number;
  order: number;
  item_type: string;
  item_id: number | null;
  prompt: string;
  choices: Record<string, string>;
  correct_answer: string;
  explanation: string;
};

export type Session = {
  id: number;
  goal_type: string;
  goal_target: number;
  progress_count: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  reflection: string;
  summary: Record<string, unknown>;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type ReadingQuestion = {
  id: number;
  passage: number;
  order: number;
  question_type: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: string;
  explanation: string;
  created_at: string;
};

export type ReadingPassage = {
  id: number;
  title: string;
  passage_type: string;
  jlpt_level: "N5" | "N4" | "N3" | "N2" | "N1";
  text_jp: string;
  text_en: string;
  source: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  questions?: ReadingQuestion[];
};

export type GrammarQuestion = {
  id: number;
  jlpt_level: "N5" | "N4" | "N3" | "N2" | "N1";
  section: string;
  question_type: string;
  context_text_jp: string;
  prompt: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: string;
  explanation: string;
  tags: string[];
  created_at: string;
};

export type FlashDeck = {
  id: number;
  name: string;
  deck_type: string;
  jlpt_level: "N5" | "N4" | "N3" | "N2" | "N1";
  system_key: string;
  is_locked: boolean;
  srs_algo: "sm2" | "fsrs";
  due_count: number;
  total_cards: number;
  created_at: string;
  updated_at: string;
};

export type FlashCard = {
  id: number;
  deck: number;
  kanji: number | null;
  kanji_character: string;
  vocab: number | null;
  vocab_word: string;
  front: string;
  back: string;
  tags: string[];
  suspended: boolean;
  repetitions: number;
  interval_days: number;
  ease_factor: number;
  due_at: string;
  last_reviewed: string | null;
  lapses: number;
  last_rating: string;
  fsrs_stability: number | null;
  fsrs_difficulty: number | null;
  fsrs_state: string;
  created_at: string;
  updated_at: string;
};

export type ExamHistoryEntry = {
  id: number;
  exam_title: string;
  score_percentage: number;
  section_scores: Record<string, { total: number; correct: number; percentage: number }>;
  passed: boolean;
  created_at: string;
};
