import { useEffect, useMemo, useState } from "react";
import { api } from "../app/api/client";
import { useMe } from "../app/state/user";
import { PageHeader } from "../components/PageHeader";
import { QuestionCard } from "../components/neuro/QuestionCard";
import { ResultScreen } from "../components/neuro/ResultScreen";
import { TreeVisualization } from "../components/neuro/TreeVisualization";
import { neuroSounds } from "../components/neuro/sound";
import type { NeuroOption, NeuroProfileResult, NeuroQuestion, NeuroTraitScores } from "../types";

type AnswerMap = Record<number, NeuroOption>;

const EMPTY_SCORES: NeuroTraitScores = {
  focus: 0,
  attention_span: 0,
  memory_retention: 0,
  distraction: 0,
  consistency: 0,
  sensory_preference: 0,
  structure: 0,
};

function projectedScores(answers: AnswerMap, questions: NeuroQuestion[]): NeuroTraitScores {
  const raw = { ...EMPTY_SCORES };
  const maxScores = { ...EMPTY_SCORES };
  Object.entries(answers).forEach(([questionId, option]) => {
    Object.entries(option.weight_mapping).forEach(([trait, weight]) => {
      raw[trait as keyof NeuroTraitScores] += Number(weight ?? 0);
    });
    const question = questions.find((item) => item.id === Number(questionId));
    const traits = new Set(question?.options.flatMap((item) => Object.keys(item.weight_mapping)) ?? []);
    traits.forEach((trait) => {
      maxScores[trait as keyof NeuroTraitScores] += Math.max(
        ...(question?.options.map((item) => Number(item.weight_mapping[trait as keyof NeuroTraitScores] ?? 0)) ?? [0]),
      );
    });
  });
  return Object.fromEntries(
    Object.entries(raw).map(([trait, value]) => {
      const maxScore = Math.max(1, maxScores[trait as keyof NeuroTraitScores]);
      return [trait, Math.min(100, Math.round((value / maxScore) * 100))];
    }),
  ) as NeuroTraitScores;
}

export function NeuroAnalysisPage() {
  const { refresh } = useMe();
  const [questions, setQuestions] = useState<NeuroQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<NeuroProfileResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [questionData, resultData] = await Promise.all([
          api<NeuroQuestion[]>("/neuro/questions/"),
          api<NeuroProfileResult>("/neuro/result/").catch(() => null),
        ]);
        if (!mounted) return;
        setQuestions(questionData);
        setResult(resultData);
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const scores = useMemo(() => (result ? result.trait_scores : projectedScores(answers, questions)), [answers, questions, result]);
  const activeQuestion = questions[current];
  const activeTrait = activeQuestion?.trait_key;
  const answeredCount = Object.keys(answers).length;

  const selectOption = async (option: NeuroOption) => {
    neuroSounds.tick();
    setAnswers((prev) => ({ ...prev, [activeQuestion.id]: option }));
    neuroSounds.whoosh();
    if (current < questions.length - 1) {
      setTimeout(() => setCurrent((value) => Math.min(value + 1, questions.length - 1)), 180);
      return;
    }

    const finalAnswers = { ...answers, [activeQuestion.id]: option };
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        answers: questions.map((question) => ({
          question_id: question.id,
          option_id: finalAnswers[question.id].id,
        })),
      };
      const data = await api<NeuroProfileResult>("/neuro/submit/", "POST", payload);
      setResult(data);
      neuroSounds.chime();
      await refresh();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setResult(null);
    setAnswers({});
    setCurrent(0);
    setPaused(false);
  };

  return (
    <div>
      <PageHeader title="Learning Style Check" subtitle="Personalize your Japanese study flow with a short comfort and focus check." />

      {error ? <div className="error">{error}</div> : null}
      {loading ? <div className="notice">Loading analysis questions...</div> : null}

      {!loading && questions.length > 0 ? (
        <div className="neuro-layout">
          <div>
            {result ? (
              <ResultScreen result={result} onRestart={restart} />
            ) : (
              <QuestionCard
                question={activeQuestion}
                selectedOptionId={answers[activeQuestion.id]?.id}
                index={current}
                total={questions.length}
                paused={paused || submitting}
                onSelect={selectOption}
                onBack={() => setCurrent((value) => Math.max(0, value - 1))}
                onPause={() => setPaused((value) => !value)}
              />
            )}
            {submitting ? <div className="notice">Analyzing your pattern...</div> : null}
          </div>

          <div>
            <TreeVisualization scores={scores} activeTrait={activeTrait} />
            <div className="neuro-mini">
              <span className="pill">{answeredCount}/{questions.length} answered</span>
              <span className="pill">Study settings update after completion</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
