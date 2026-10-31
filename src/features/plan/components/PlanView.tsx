"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CalendarIcon, CheckIcon } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { apiJson, type Plan, type PlanSummary, type PlanTask, type PlanWeek, type WeekContent } from "../types";

const KIND_LABEL: Record<PlanTask["kind"], string> = {
  learn: "Learn",
  exercise: "Exercise",
  coding: "Coding",
  assessment: "Assessment",
  project_milestone: "Milestone",
};
const KIND_TONE: Record<PlanTask["kind"], Tone> = {
  learn: "primary",
  exercise: "secondary",
  coding: "secondary",
  assessment: "warning",
  project_milestone: "accent",
};

export function PlanView({
  initialPlan,
  plans,
  hasAnalysis,
  defaults,
}: {
  initialPlan: Plan | null;
  plans: PlanSummary[];
  hasAnalysis: boolean;
  defaults: { weeks: number; hoursPerWeek: number };
}) {
  const [plan, setPlan] = useState(initialPlan);
  const [showForm, setShowForm] = useState(!initialPlan);

  if (!hasAnalysis && !plan) {
    return (
      <Card className="mt-6 grid gap-3">
        <p>Your plan is built from a saved skill-gap analysis. Run one first.</p>
        <ButtonLink href="/analyze" className="justify-self-start">
          Analyze my resume
        </ButtonLink>
      </Card>
    );
  }

  return (
    <div className="mt-6 grid gap-6">
      {plan && <PlanSummaryCard plan={plan} plans={plans} onRegenerate={() => setShowForm((s) => !s)} />}
      {showForm && hasAnalysis && (
        <CreatePlanForm
          defaults={plan ? { weeks: plan.durationWeeks, hoursPerWeek: plan.hoursPerWeek } : defaults}
          regenerate={!!plan}
          onCreated={(p) => {
            setPlan(p);
            setShowForm(false);
          }}
        />
      )}
      {plan && (
        <div className="grid gap-4">
          {plan.weeks.map((w) => (
            <WeekCard
              key={w.id}
              week={w}
              hoursPerWeek={plan.hoursPerWeek}
              readOnly={plan.status !== "active"}
              onTask={(task) =>
                setPlan((p) =>
                  p && {
                    ...p,
                    weeks: p.weeks.map((x) =>
                      x.id === w.id ? { ...x, tasks: x.tasks.map((t) => (t.id === task.id ? { ...t, ...task } : t)) } : x,
                    ),
                  },
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CreatePlanForm({
  defaults,
  regenerate,
  onCreated,
}: {
  defaults: { weeks: number; hoursPerWeek: number };
  regenerate: boolean;
  onCreated: (plan: Plan) => void;
}) {
  const [weeks, setWeeks] = useState(String(defaults.weeks));
  const [hours, setHours] = useState(String(defaults.hoursPerWeek));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const plan = await apiJson<Plan>("/api/v1/plans", {
        method: "POST",
        body: JSON.stringify({ weeks: Number(weeks), hoursPerWeek: Number(hours) }),
      });
      onCreated(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const hoursValid = Number.isInteger(Number(hours)) && Number(hours) >= 1 && Number(hours) <= 60;
  return (
    <Card className="grid gap-4">
      <div>
        <h2 className="font-semibold">{regenerate ? "Regenerate plan" : "Create your learning plan"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Built from your latest skill-gap analysis. Prerequisites come first, each week keeps about 15% spare, and some
          time is set aside for portfolio projects.
          {regenerate && " Your current plan is kept as an earlier version."}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 sm:max-w-md">
        <Field label="Weeks">
          <Select value={weeks} onChange={(e) => setWeeks(e.target.value)}>
            {[4, 8, 12, 16].map((n) => (
              <option key={n} value={n}>
                {n} weeks
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hours per week">
          <Input type="number" min={1} max={60} value={hours} onChange={(e) => setHours(e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-2 sm:flex sm:items-center sm:gap-4">
        <Button onClick={create} disabled={busy || !hoursValid}>
          {busy ? "Building your plan… (up to a minute)" : regenerate ? "Regenerate plan" : "Create plan"}
        </Button>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Card>
  );
}

function PlanSummaryCard({
  plan,
  plans,
  onRegenerate,
}: {
  plan: Plan;
  plans: PlanSummary[];
  onRegenerate: () => void;
}) {
  const { totals, coverage, deferred } = plan;
  const pct = totals.tasks ? (totals.done / totals.tasks) * 100 : 0;
  const templateText = plan.weeks.some((w) => (w.content as WeekContent | null)?.textSource === "template");
  return (
    <Card className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">
              {plan.targetRole ? `${plan.targetRole} plan` : "Learning plan"} · v{plan.version}
            </h2>
            <Badge tone={plan.status === "active" ? "success" : "neutral"}>{plan.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {plan.durationWeeks} weeks · {plan.hoursPerWeek} h/week · starts {new Date(plan.startDate).toLocaleDateString()}
            {plan.reason && ` · ${plan.reason}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.status === "active" && (
            <Button variant="outline" size="sm" onClick={onRegenerate}>
              Regenerate
            </Button>
          )}
          <ButtonLink href="/projects" variant="outline" size="sm">
            Portfolio projects
          </ButtonLink>
        </div>
      </div>

      <div className="grid gap-1.5">
        <div className="flex justify-between text-sm">
          <span>
            {totals.done} of {totals.tasks} tasks done
          </span>
          <span className="text-muted-foreground">
            {fmt(totals.hoursSpent)} of {fmt(totals.plannedHours)} h
          </span>
        </div>
        <ProgressBar value={pct} label="Plan progress" />
      </div>

      {coverage.ok ? (
        <Alert tone="success">All of your top {coverage.top.length} gaps are covered by this plan.</Alert>
      ) : (
        <Alert tone="danger">
          These top gaps don&apos;t fit in this timeline: <strong>{coverage.missing.map((m) => m.name).join(", ")}</strong>.
          Add weeks or hours per week, or accept that they come later.
        </Alert>
      )}
      {deferred.length > 0 && (
        <div className="text-sm">
          <span className="font-medium">Not in this plan (no time left):</span>{" "}
          <span className="text-muted-foreground">{deferred.map((d) => d.name).join(", ")}</span>
        </div>
      )}
      {templateText && (
        <p className="text-xs text-muted-foreground">
          Some week descriptions use standard text because the AI was unavailable when the plan was built.
        </p>
      )}
      {plans.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Plan versions ({plans.length})</summary>
          <ul className="mt-2 grid gap-1">
            {plans.map((p) => (
              <li key={p.id}>
                <Link href={`/plan/${p.id}`} className={cn("hover:underline", p.id === plan.id && "font-semibold")}>
                  v{p.version} · {p.status} · {p.durationWeeks} weeks · {p.tasks.done}/{p.tasks.total} done ·{" "}
                  {new Date(p.createdAt).toLocaleDateString()}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function WeekCard({
  week,
  hoursPerWeek,
  readOnly,
  onTask,
}: {
  week: PlanWeek;
  hoursPerWeek: number;
  readOnly: boolean;
  onTask: (task: Partial<PlanTask> & { id: string }) => void;
}) {
  const content = (week.content ?? {}) as WeekContent;
  const objectives = Array.isArray(week.objectives) ? (week.objectives as string[]) : [];
  const done = week.tasks.filter((t) => t.status === "done").length;
  return (
    <Card className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <CalendarIcon className="size-4" /> Week {week.weekNumber}
            {week.startDate && (
              <span className="font-normal text-muted-foreground">· {new Date(week.startDate).toLocaleDateString()}</span>
            )}
          </p>
          <h3 className="mt-1 font-semibold">{week.goal}</h3>
        </div>
        <div className="min-w-40 text-right text-sm">
          <span className="text-muted-foreground">
            {fmt(week.plannedHours)} / {hoursPerWeek} h · {done}/{week.tasks.length} done
          </span>
          <ProgressBar
            value={(week.plannedHours / hoursPerWeek) * 100}
            tone="secondary"
            className="mt-1"
            label={`Week ${week.weekNumber} planned hours`}
          />
        </div>
      </div>

      {objectives.length > 0 && (
        <ul className="grid gap-1 text-sm">
          {objectives.map((o, i) => (
            <li key={i} className="flex gap-2">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" /> {o}
            </li>
          ))}
        </ul>
      )}

      {week.tasks.length > 0 && (
        <ul className="grid divide-y divide-border rounded-lg border border-border">
          {week.tasks.map((t) => (
            <TaskRow key={t.id} task={t} readOnly={readOnly} onChange={onTask} />
          ))}
        </ul>
      )}

      {(content.exercises?.length ?? 0) > 0 && (
        <div className="text-sm">
          <p className="font-medium">Exercises</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {content.exercises!.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {(content.resources?.length ?? 0) > 0 && (
        <div className="text-sm">
          <p className="font-medium">Resources</p>
          <ul className="mt-1 grid gap-0.5">
            {content.resources!.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {r.title}
                </a>{" "}
                <span className="text-muted-foreground">
                  · {r.skill} · {r.kind}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {week.checkpoint && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="font-medium">Checkpoint:</span> {week.checkpoint}
        </p>
      )}
    </Card>
  );
}

function TaskRow({
  task,
  readOnly,
  onChange,
}: {
  task: PlanTask;
  readOnly: boolean;
  onChange: (task: Partial<PlanTask> & { id: string }) => void;
}) {
  const [hours, setHours] = useState(String(task.hoursSpent));
  const [score, setScore] = useState(task.score == null ? "" : String(Math.round(task.score * 100)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = task.status === "done";

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiJson<Partial<PlanTask> & { id: string }>(`/api/v1/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onChange(updated);
      if (updated.hoursSpent !== undefined) setHours(String(updated.hoursSpent));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const resource = task.resource ?? (task.resourceUrl ? { title: "Resource", url: task.resourceUrl } : null);
  return (
    <li className="grid gap-2 px-3 py-2.5 sm:flex sm:items-center sm:gap-3">
      <label className="flex min-w-0 flex-1 items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-[var(--color-primary)]"
          checked={done}
          disabled={readOnly || busy}
          onChange={() => patch({ status: done ? "todo" : "done" })}
        />
        <span className="min-w-0">
          <span className={cn("text-sm", done && "text-muted-foreground line-through")}>{task.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={KIND_TONE[task.kind]}>{KIND_LABEL[task.kind]}</Badge>
            <span className="text-xs text-muted-foreground">{fmt(task.estHours)} h</span>
            {resource && (
              <a
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="truncate text-xs text-primary hover:underline"
              >
                {resource.title}
              </a>
            )}
          </span>
        </span>
      </label>
      {!readOnly && (
        <div className="flex items-center gap-2 pl-7 sm:pl-0">
          {task.kind === "assessment" && (
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="Score %"
              aria-label="Assessment score (%)"
              className="h-9 w-24 py-1 text-sm"
              value={score}
              disabled={busy}
              onChange={(e) => setScore(e.target.value)}
              onBlur={() => {
                const n = Number(score);
                if (score !== "" && n >= 0 && n <= 100 && n / 100 !== task.score) patch({ score: n / 100 });
              }}
            />
          )}
          <Input
            type="number"
            min={0}
            step={0.5}
            aria-label="Hours spent"
            title="Hours spent"
            className="h-9 w-20 py-1 text-sm"
            value={hours}
            disabled={busy}
            onChange={(e) => setHours(e.target.value)}
            onBlur={() => {
              const n = Number(hours);
              if (hours !== "" && n >= 0 && n !== task.hoursSpent) patch({ hoursSpent: n });
            }}
          />
          <span className="text-xs text-muted-foreground">h</span>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </li>
  );
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
