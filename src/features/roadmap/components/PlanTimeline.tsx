import Link from "next/link";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { BriefcaseIcon, CheckIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { RoadmapData, TimelineWeek } from "../types";

type Plan = NonNullable<RoadmapData["plan"]>;

const CHECKPOINT: Record<TimelineWeek["checkpoint"]["status"], { label: string; tone: Tone }> = {
  passed: { label: "Checkpoint passed", tone: "success" },
  failed: { label: "Checkpoint below 60%", tone: "danger" },
  pending: { label: "Checkpoint pending", tone: "warning" },
  none: { label: "No checkpoint", tone: "neutral" },
};

const STATE: Record<TimelineWeek["state"], { label: string; tone: Tone }> = {
  past: { label: "Past", tone: "neutral" },
  current: { label: "This week", tone: "primary" },
  upcoming: { label: "Upcoming", tone: "neutral" },
};

/** Week-by-week view of the active plan: goal, skills, progress, checkpoint, project milestones. */
export function PlanTimeline({ plan }: { plan: Plan }) {
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        {plan.durationWeeks} weeks at {plan.hoursPerWeek} h/week · {plan.totals.done}/{plan.totals.tasks} tasks done ·{" "}
        {Math.round(plan.totals.hoursSpent * 10) / 10}/{Math.round(plan.totals.plannedHours * 10) / 10} h
        {plan.currentWeek === 0 && " · starts soon"}
      </p>
      <ol aria-label="Plan weeks" className="relative grid gap-4 border-l-2 border-border pl-5 sm:pl-6">
        {plan.weeks.map((w) => (
          <WeekItem key={w.weekNumber} week={w} />
        ))}
        {plan.deferred.length > 0 && (
          <li className="relative">
            <span aria-hidden className="absolute top-5 -left-[1.6rem] size-3 rounded-full border-2 border-border bg-card sm:-left-[1.85rem]" />
            <Card className="border-dashed">
              <h3 className="font-semibold">Didn&apos;t fit in this plan</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                These gaps are deferred. Add weeks or hours on the{" "}
                <Link href="/plan" className="font-medium text-primary underline">
                  plan page
                </Link>{" "}
                to include them.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Deferred skills">
                {plan.deferred.map((d) => (
                  <li key={d.skillId}>
                    <Badge tone="warning">{d.name}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          </li>
        )}
      </ol>
    </div>
  );
}

function WeekItem({ week: w }: { week: TimelineWeek }) {
  const current = w.state === "current";
  const complete = w.tasksTotal > 0 && w.tasksDone >= w.tasksTotal;
  const cp = CHECKPOINT[w.checkpoint.status];
  return (
    <li className="relative" aria-current={current ? "step" : undefined}>
      <span
        aria-hidden
        className={cn(
          "absolute top-5 -left-[1.6rem] grid size-3 place-items-center rounded-full border-2 sm:-left-[1.85rem]",
          complete ? "border-success bg-success" : current ? "border-primary bg-primary" : "border-border bg-card",
        )}
      />
      <Card className={cn("grid gap-3", current && "border-primary ring-2 ring-primary/20", w.state === "upcoming" && "bg-card/70")}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">Week {w.weekNumber}</h3>
          <Badge tone={STATE[w.state].tone}>{STATE[w.state].label}</Badge>
          {complete && (
            <Badge tone="success">
              <CheckIcon className="size-3" /> Complete
            </Badge>
          )}
          <Badge tone={cp.tone} className="sm:ml-auto" title={w.checkpoint.text ?? undefined}>
            {cp.label}
          </Badge>
        </div>
        <p className="text-sm">{w.goal}</p>

        {w.skills.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={`Skills in week ${w.weekNumber}`}>
            {w.skills.map((s) => (
              <li key={s}>
                <Badge tone="secondary">{s}</Badge>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {w.tasksDone}/{w.tasksTotal} tasks
            </span>
            <span>
              {w.hoursSpent}/{w.hoursPlanned} h
            </span>
          </div>
          <ProgressBar
            value={w.tasksTotal ? (w.tasksDone / w.tasksTotal) * 100 : 0}
            tone={complete ? "success" : "brand"}
            label={`Week ${w.weekNumber} tasks done`}
          />
        </div>

        {w.checkpoint.text && w.checkpoint.status !== "none" && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Checkpoint:</span> {w.checkpoint.text}
          </p>
        )}

        {w.milestones.length > 0 && (
          <ul className="grid gap-1.5" aria-label={`Project milestones in week ${w.weekNumber}`}>
            {w.milestones.map((m) => (
              <li
                key={m.id}
                className="flex items-start gap-2 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground"
              >
                <BriefcaseIcon className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="sr-only">Project milestone: </span>
                  {m.title}
                </span>
                {m.status === "done" && <CheckIcon className="mt-0.5 size-4 shrink-0" aria-label="done" />}
              </li>
            ))}
          </ul>
        )}

        {w.missed.length > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
            <p className="font-medium">
              {w.missed.length} task{w.missed.length === 1 ? "" : "s"} missed
            </p>
            <ul className="mt-1 list-disc pl-5">
              {w.missed.slice(0, 4).map((t) => (
                <li key={t.id}>{t.title}</li>
              ))}
              {w.missed.length > 4 && <li>and {w.missed.length - 4} more</li>}
            </ul>
          </div>
        )}
      </Card>
    </li>
  );
}
