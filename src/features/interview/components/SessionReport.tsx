import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScoreRing } from "@/components/ui/ScoreRing";
import type { SessionSummary } from "../types";
import { FeedbackList } from "./EvaluationCard";

/** End-of-session report: session score, recurring weaknesses, weak skills, missing concepts, next steps. */
export function SessionReport({ summary }: { summary: SessionSummary }) {
  return (
    <Card className="grid gap-6">
      <div className="flex items-center gap-4">
        <ScoreRing value={summary.sessionScore ?? 0} size={104} suffix="" label="/ 100" />
        <div>
          <div className="font-display text-xl font-bold">Session score</div>
          <p className="text-sm text-muted-foreground">
            Average of your {summary.answered} scored answer{summary.answered === 1 ? "" : "s"}.
          </p>
        </div>
      </div>

      {summary.overview && <p className="text-pretty">{summary.overview}</p>}
      {summary.source === "fallback" && (
        <Alert tone="warning">The AI coach was unavailable, so this report was built from your scores only.</Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FeedbackList title="What went well" items={summary.strengths} />
        <div>
          <h3 className="font-medium">Next steps</h3>
          <ol className="mt-1 list-decimal pl-5 text-sm text-muted-foreground marker:text-secondary">
            {summary.nextSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      </div>

      {summary.recurringWeaknesses.length > 0 && (
        <div>
          <h3 className="font-medium">Recurring weaknesses</h3>
          <p className="text-sm text-muted-foreground">Criteria that scored 2 or lower in more than one answer.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {summary.recurringWeaknesses.map((w) => (
              <Badge key={w.criterion} tone="danger">
                {w.criterion} · avg {w.mean}/5
              </Badge>
            ))}
          </div>
        </div>
      )}

      {summary.criteria.length > 0 && (
        <div>
          <h3 className="font-medium">By criterion</h3>
          <ul className="mt-2 grid gap-2">
            {summary.criteria.map((c) => (
              <li key={c.criterion} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span>{c.criterion}</span>
                  <span className="text-muted-foreground">
                    {c.mean}/5 · {c.count} answer{c.count === 1 ? "" : "s"}
                  </span>
                </div>
                <ProgressBar value={((c.mean - 1) / 4) * 100} className="mt-1 h-2" label={c.criterion} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.skills.length > 0 && (
        <div>
          <h3 className="font-medium">By skill</h3>
          <p className="text-sm text-muted-foreground">These scores now count toward your skill levels.</p>
          <ul className="mt-2 grid gap-2">
            {summary.skills.map((s) => (
              <li key={s.skillId} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span>{s.skillName}</span>
                  <span className="text-muted-foreground">{s.mean}/100</span>
                </div>
                <ProgressBar value={s.mean} tone={s.mean < 60 ? "warning" : "brand"} className="mt-1 h-2" label={s.skillName} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.missingConcepts.length > 0 && (
        <div>
          <h3 className="font-medium">Concepts to study</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {summary.missingConcepts.map((c) => (
              <Badge key={c.concept} tone="neutral">
                {c.concept}
                {c.count > 1 ? ` ×${c.count}` : ""}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
