import type { AnswerPayload, ExamQuestion, QuestionSection } from "../../api/exam";

const SECTION_ORDER: QuestionSection[] = ["vocabulary", "grammar", "reading", "listening"];
const SECTION_SHORT: Record<QuestionSection, string> = {
  vocabulary: "語彙",
  grammar: "文法",
  reading: "読解",
  listening: "聴解",
};

interface Props {
  questions: ExamQuestion[];
  currentIndex: number;
  answers: Map<number, AnswerPayload>;
  onNavigate: (index: number) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function NavigationPanel({
  questions,
  currentIndex,
  answers,
  onNavigate,
  onSubmit,
  submitting,
}: Props) {
  // Group by section for the mini-map
  const sections = SECTION_ORDER.filter((s) => questions.some((q) => q.section === s));

  const answeredCount = answers.size;
  const totalCount = questions.length;
  const unansweredCount = totalCount - answeredCount;

  return (
    <div className="nav-panel">
      <div className="nav-panel__summary">
        <span className="nav-panel__answered">{answeredCount} answered</span>
        {unansweredCount > 0 && (
          <span className="nav-panel__unanswered">{unansweredCount} remaining</span>
        )}
      </div>

      {sections.map((section) => {
        const sectionQs = questions
          .map((q, i) => ({ q, i }))
          .filter(({ q }) => q.section === section);

        return (
          <div key={section} className="nav-panel__section">
            <div className="nav-panel__section-label">{SECTION_SHORT[section]}</div>
            <div className="nav-panel__grid">
              {sectionQs.map(({ q, i }) => {
                const answered = answers.has(q.id);
                const active = i === currentIndex;
                return (
                  <button
                    key={q.id}
                    className={[
                      "nav-panel__cell",
                      active ? "nav-panel__cell--active" : "",
                      answered ? "nav-panel__cell--answered" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => onNavigate(i)}
                    aria-label={`Question ${i + 1}${answered ? " (answered)" : ""}`}
                    aria-current={active ? "true" : undefined}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="nav-panel__actions">
        <button
          className="btn nav-panel__submit"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? "Submitting…" : "Submit Exam"}
        </button>
        {unansweredCount > 0 && (
          <p className="nav-panel__warning">
            {unansweredCount} question{unansweredCount > 1 ? "s" : ""} unanswered
          </p>
        )}
      </div>
    </div>
  );
}
