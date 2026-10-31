import type { RubricCriterion } from "@/lib/ai/prompts/interview-scoring";

/** The criteria an answer is scored on, shown before the user answers. */
export function RubricList({ rubric }: { rubric: RubricCriterion[] }) {
  return (
    <div className="rounded-xl bg-muted p-4">
      <h3 className="text-sm font-medium">How this answer is scored (1–5 each)</h3>
      <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground">
        {rubric.map((c) => (
          <li key={c.criterion}>
            <span className="font-medium text-foreground">{c.criterion}:</span> {c.description}
          </li>
        ))}
      </ul>
    </div>
  );
}
