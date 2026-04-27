import type { NeuroOption, NeuroQuestion } from "../../types";

export function QuestionCard({
  question,
  selectedOptionId,
  index,
  total,
  paused,
  onSelect,
  onBack,
  onPause,
}: {
  question: NeuroQuestion;
  selectedOptionId?: number;
  index: number;
  total: number;
  paused: boolean;
  onSelect: (option: NeuroOption) => void;
  onBack: () => void;
  onPause: () => void;
}) {
  return (
    <section className="neuro-question" aria-labelledby="neuro-question-title">
      <div className="neuro-progressline">
        <span>
          Question {index + 1} of {total}
        </span>
        <button className="btn" onClick={onPause}>
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
      <div className="neuro-progressbar" aria-hidden="true">
        <div style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      <h2 id="neuro-question-title" className="neuro-question__title">
        {question.question_text}
      </h2>

      <div className="neuro-options">
        {question.options.map((option) => (
          <button
            key={option.id}
            className={selectedOptionId === option.id ? "neuro-option neuro-option--selected" : "neuro-option"}
            disabled={paused}
            onClick={() => onSelect(option)}
          >
            <span>{option.text}</span>
          </button>
        ))}
      </div>

      <div className="neuro-question__footer">
        <button className="btn" onClick={onBack} disabled={index === 0 || paused}>
          Back
        </button>
        <span className="pill">{question.trait_key.replace("_", " ")}</span>
      </div>
    </section>
  );
}
