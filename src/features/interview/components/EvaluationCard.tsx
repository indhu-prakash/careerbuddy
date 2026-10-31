import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScoreRing } from "@/components/ui/ScoreRing";
import type { Evaluation } from "../types";

/** Rubric scores, feedback and model answer for one scored answer. */
export function EvaluationCard({ evaluation }: { evaluation: Evaluation }) {
  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-4">
        <ScoreRing value={evaluation.overallScore} size={88} suffix="" label="/ 100" />
        <div>
          <div className="font-display text-xl font-bold">Answer score</div>
          <p className="text-sm text-muted-foreground">Computed from the rubric scores below.</p>
        </div>
      </div>
      <ul className="grid gap-3">
        {evaluation.criteria.map((c) => (
          <li key={c.criterion}>
            <div className="flex justify-between gap-2 font-medium">
              <span>{c.criterion}</span>
              <span className="text-muted-foreground">{c.score}/5</span>
            </div>
            <ProgressBar
              value={c.score * 20}
              tone={c.score <= 2 ? "danger" : c.score === 3 ? "warning" : "brand"}
              className="mt-1.5 h-2"
              label={c.criterion}
            />
            <div className="mt-1.5 text-sm text-muted-foreground">{c.comment}</div>
          </li>
        ))}
      </ul>
      <div className="grid gap-4 sm:grid-cols-2">
        <FeedbackList title="Strengths" items={evaluation.strengths} />
        <FeedbackList title="To improve" items={evaluation.improvements} />
      </div>
      <FeedbackList title="Concepts you didn't mention" items={evaluation.missingConcepts} />
      {evaluation.modelAnswer && (
        <div className="rounded-xl bg-muted p-4">
          <h3 className="font-medium">Model answer</h3>
          <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{evaluation.modelAnswer}</p>
        </div>
      )}
    </div>
  );
}

export function FeedbackList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground marker:text-secondary">
        {items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
