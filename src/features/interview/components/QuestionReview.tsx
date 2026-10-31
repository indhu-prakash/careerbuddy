import { Badge } from "@/components/ui/Badge";
import { TYPE_LABELS, type Evaluation, type Question } from "../types";
import { EvaluationCard } from "./EvaluationCard";

export function asEvaluation(e: NonNullable<Question["evaluation"]>): Evaluation {
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);
  return {
    overallScore: e.overallScore,
    criteria: Array.isArray(e.criteria) ? (e.criteria as Evaluation["criteria"]) : [],
    strengths: strings(e.strengths),
    improvements: strings(e.improvements),
    missingConcepts: strings(e.missingConcepts),
    modelAnswer: e.modelAnswer,
  };
}

/** Type, skill and follow-up badges for a question. */
export function QuestionBadges({ question }: { question: Question }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone="primary">{TYPE_LABELS[question.type] ?? question.type}</Badge>
      {question.skill && <Badge tone="secondary">{question.skill.name}</Badge>}
      {question.parentId && <Badge tone="accent">Follow-up</Badge>}
    </div>
  );
}

/** Collapsible list of answered questions with their answers and feedback. */
export function QuestionReview({ questions }: { questions: Question[] }) {
  const answered = questions.filter((q) => q.evaluation);
  if (answered.length === 0) return null;
  return (
    <ul className="grid gap-3">
      {answered.map((q, i) => (
        <li key={q.id}>
          <details className="group rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
              <div className="grid gap-2">
                <QuestionBadges question={q} />
                <span className="font-medium">
                  {i + 1}. {q.question}
                </span>
              </div>
              <span className="shrink-0 font-display text-xl font-bold">{Math.round(q.evaluation!.overallScore)}</span>
            </summary>
            <div className="mt-4 grid gap-4 border-t border-border pt-4">
              <div>
                <h3 className="text-sm font-medium">Your answer</h3>
                <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{q.answer}</p>
              </div>
              <EvaluationCard evaluation={asEvaluation(q.evaluation!)} />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
