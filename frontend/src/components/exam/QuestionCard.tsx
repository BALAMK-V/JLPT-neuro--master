import type { AnswerPayload, ExamQuestion } from "../../api/exam";
import { ExamAudioPlayer } from "./ExamAudioPlayer";
import { ImageViewer } from "./ImageViewer";

const SECTION_LABELS: Record<string, string> = {
  vocabulary: "語彙 Vocabulary",
  grammar: "文法 Grammar",
  reading: "読解 Reading",
  listening: "聴解 Listening",
};

interface Props {
  question: ExamQuestion;
  answer: AnswerPayload | undefined;
  onAnswer: (payload: AnswerPayload) => void;
  questionNumber: number;
  totalQuestions: number;
}

export function QuestionCard({ question, answer, onAnswer, questionNumber, totalQuestions }: Props) {
  const startTimeRef = { current: Date.now() };

  function select(optionId: number) {
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    onAnswer({
      question: question.id,
      selected_option: optionId,
      time_taken_seconds: (answer?.time_taken_seconds ?? 0) + elapsed,
    });
    startTimeRef.current = Date.now();
  }

  function handleTextAnswer(value: string) {
    onAnswer({
      question: question.id,
      selected_option: null,
      text_answer: value,
      time_taken_seconds: answer?.time_taken_seconds ?? 0,
    });
  }

  const selectedOptionId = answer?.selected_option ?? null;

  return (
    <div className="question-card">
      <div className="question-card__header">
        <span className="question-card__section">{SECTION_LABELS[question.section] ?? question.section}</span>
        <span className="question-card__counter">
          {questionNumber} / {totalQuestions}
        </span>
      </div>

      {/* Reading passage shown above question */}
      {question.passage_text && (
        <div className="question-card__passage">
          <div className="question-card__passage-label">文章 Passage</div>
          <p className="question-card__passage-text">{question.passage_text}</p>
        </div>
      )}

      {/* Audio for listening questions */}
      {question.audio_file && (
        <div className="question-card__audio">
          <ExamAudioPlayer src={question.audio_file} playCount={2} />
        </div>
      )}

      {/* Question image */}
      {question.question_image && (
        <div className="question-card__image">
          <ImageViewer src={question.question_image} alt="Question image" />
        </div>
      )}

      {/* Question text */}
      <div className="question-card__text">{question.question_text}</div>

      {/* Options */}
      {question.question_type !== "fill_blank" && question.options.length > 0 && (
        <div className="question-card__options">
          {question.options.map((opt) => (
            <button
              key={opt.id}
              className={`question-card__option ${selectedOptionId === opt.id ? "question-card__option--selected" : ""}`}
              onClick={() => select(opt.id)}
            >
              <span className="question-card__option-label">{opt.label}</span>
              {opt.image ? (
                <img src={opt.image} alt={`Option ${opt.label}`} className="question-card__option-img" />
              ) : (
                <span className="question-card__option-text">{opt.text}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Fill-in-the-blank input */}
      {question.question_type === "fill_blank" && (
        <div className="question-card__fill">
          <input
            type="text"
            className="question-card__fill-input"
            placeholder="答えを入力してください"
            value={answer?.text_answer ?? ""}
            onChange={(e) => handleTextAnswer(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
