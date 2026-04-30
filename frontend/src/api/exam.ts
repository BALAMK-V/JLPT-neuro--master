import { api } from "../app/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export type SectionType = "language_knowledge" | "reading" | "listening" | "full";

export type QuestionSection = "vocabulary" | "grammar" | "reading" | "listening";

export type QuestionType =
  | "multiple_choice"
  | "image_based"
  | "audio_based"
  | "fill_blank"
  | "sentence_arrange";

export interface ExamOption {
  id: number;
  label: string;
  text: string;
  image: string | null;
}

export interface ExamOptionWithAnswer extends ExamOption {
  is_correct: boolean;
}

export interface ExamQuestion {
  id: number;
  order: number;
  section: QuestionSection;
  question_type: QuestionType;
  question_text: string;
  question_image: string | null;
  audio_file: string | null;
  passage_text: string;
  points: number;
  options: ExamOption[];
}

export interface ExamQuestionWithAnswer extends ExamQuestion {
  options: ExamOptionWithAnswer[];
  explanation: string;
  user_selected_option: number | null;
  user_is_correct: boolean;
  time_taken_seconds: number;
}

export interface JLPTExamSummary {
  id: number;
  level: JLPTLevel;
  title: string;
  description: string;
  section_type: SectionType;
  duration_minutes: number;
  is_official_style: boolean;
  is_published: boolean;
  question_count: number;
  created_at: string;
}

export interface JLPTExamDetail extends JLPTExamSummary {
  questions: ExamQuestion[];
}

export interface UserExamSession {
  id: number;
  exam: number;
  status: "in_progress" | "submitted" | "abandoned";
  started_at: string;
  submitted_at: string | null;
  time_remaining_seconds: number;
}

export interface SectionScore {
  total: number;
  correct: number;
  percentage: number;
}

export interface ExamResult {
  id: number;
  exam: number;
  exam_title: string;
  exam_level: JLPTLevel;
  session: number;
  total_questions: number;
  correct_answers: number;
  score_percentage: number;
  time_taken_seconds: number;
  section_scores: Record<QuestionSection, SectionScore>;
  weak_areas: string[];
  study_suggestions: string[];
  passed: boolean;
  created_at: string;
}

export interface UserAnalysis {
  total_exams: number;
  recent_score: number;
  persistent_weak_areas: Array<{ area: string; occurrences: number }>;
  top_suggestions: string[];
  section_trends: Record<QuestionSection, number[]>;
}

export interface AnswerPayload {
  question: number;
  selected_option: number | null;
  text_answer?: string;
  time_taken_seconds: number;
}

export interface SubmitPayload {
  answers: AnswerPayload[];
  time_remaining_seconds: number;
}

export interface QuestionPaper {
  id: number;
  file: string;
  file_type: "image" | "pdf";
  original_filename: string;
  level: JLPTLevel;
  status: "pending" | "processing" | "completed" | "failed";
  extracted_text: string;
  parsed_questions: ParsedQuestion[];
  ai_parsed_questions: ParsedQuestion[];
  question_count: number;
  error_message: string;
  created_at: string;
  processed_at: string | null;
}

export interface ParsedQuestion {
  section: QuestionSection;
  order: number;
  question_text: string;
  options: Array<{ label: string; text: string }>;
  question_type: QuestionType;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const examApi = {
  listExams: (level?: JLPTLevel) =>
    api<{ results: JLPTExamSummary[]; count: number }>(
      `/exams/${level ? `?level=${level}&is_published=true` : "?is_published=true"}`
    ),

  getExam: (id: number) => api<JLPTExamDetail>(`/exams/${id}/`),

  startExam: (examId: number) =>
    api<UserExamSession>(`/exam-sessions/`, "POST", { exam: examId }),

  getSessions: () => api<{ results: UserExamSession[] }>("/exam-sessions/"),

  submitExam: (sessionId: number, payload: SubmitPayload) =>
    api<ExamResult>(`/exam-sessions/${sessionId}/submit/`, "POST", payload),

  getResult: (resultId: number) => api<ExamResult>(`/exam-results/${resultId}/`),

  getResultReview: (resultId: number) =>
    api<ExamQuestionWithAnswer[]>(`/exam-results/${resultId}/review/`),

  getMyResults: () =>
    api<ExamResult[]>(`/exams/my-results/`),

  getUserAnalysis: () => api<UserAnalysis>("/analysis/"),

  // OCR
  uploadPaper: (formData: FormData) => {
    const token = localStorage.getItem("access_token");
    return fetch(`${(import.meta as any).env?.VITE_API_BASE ?? "http://127.0.0.1:8000/api"}/ocr/upload/`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (res) => {
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<QuestionPaper>;
    });
  },

  getPapers: () => api<QuestionPaper[]>("/ocr/papers/"),

  getPaper: (id: number) => api<QuestionPaper>(`/ocr/papers/${id}/`),

  importParsedQuestions: (paperId: number, examTitle: string, level: JLPTLevel) =>
    api<{ exam_id: number; exam_title: string; questions_imported: number }>(
      "/ocr/import/",
      "POST",
      { paper_id: paperId, exam_title: examTitle }
    ),

  aiParsePaper: (paperId: number) =>
    api<{ questions_found: number; ai_parsed_questions: ParsedQuestion[] }>(
      `/ocr/papers/${paperId}/ai-parse/`,
      "POST"
    ),

  updateParsedQuestions: (paperId: number, questions: ParsedQuestion[]) =>
    api<{ saved: number; parsed_questions: ParsedQuestion[] }>(
      `/ocr/papers/${paperId}/questions/`,
      "PATCH",
      { questions }
    ),
};
