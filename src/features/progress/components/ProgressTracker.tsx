"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

export type ChangeSummary = {
  explanation: string;
  triggers: { kind: string; reason: string }[];
  added: { title: string; weekNumber: number; skill: string | null }[];
  removed: { title: string; weekNumber: number; skill: string | null }[];
  moved: { title: string; from: number; to: number }[];
  deferred: string[];
};

export type ProgressData = {
  planId: string | null;
  triggers: { kind: string; reason: string }[];
  pending: { id: string; version: number; reason: string | null; changeSummary: ChangeSummary | null } | null;
  skills: { skillId: string; name: string; level: number }[];
  events: { id: string; kind: string; hours: number | null; value: number | null; note: string | null; occurredAt: string; skill: string | null; task: string | null }[];
};

const LEVELS = ["None", "Beginner", "Intermediate", "Advanced", "Expert"];
const KIND_LABEL: Record<string, string> = {
  task_completed: "Task done",
  task_missed: "Task missed",
  hours_logged: "Hours logged",
  assessment_scored: "Checkpoint",
  interview_scored: "Interview answer",
  project_milestone: "Project milestone",
  skill_level_changed: "Self-rating",
  plan_revised: "Plan revised",
};

export function ProgressTracker({ data }: { data: ProgressData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hours, setHours] = useState("");
  const [hoursSkill, setHoursSkill] = useState("");
  const [rateSkill, setRateSkill] = useState(data.skills[0]?.skillId ?? "");
  const [rating, setRating] = useState(3);

  async function post(key: string, url: string, body?: unknown, done?: string) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.error === "ai_daily_limit"
            ? "You've reached today's AI limit. Try again tomorrow."
            : json.error === "no_changes"
              ? "Nothing needs to change right now."
              : "That didn't work. Try again.",
        );
      }
      if (done) setNotice(done);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const cs = data.pending?.changeSummary;

  return (
    <div className="mt-6 grid gap-6">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {data.pending && (
        <Card className="grid gap-4 border-warning/40">
          <div>
            <h2 className="font-semibold">Proposed plan, version {data.pending.version}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{cs?.explanation ?? data.pending.reason}</p>
          </div>
          {cs && (
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <DiffList title="Added" tone="success" items={cs.added.map((t) => `W${t.weekNumber}: ${t.title}`)} />
              <DiffList title="Removed" tone="danger" items={cs.removed.map((t) => `W${t.weekNumber}: ${t.title}`)} />
              <DiffList title="Moved" tone="warning" items={cs.moved.map((t) => `${t.title}: week ${t.from} → ${t.to}`)} />
            </div>
          )}
          {cs?.deferred.length ? (
            <p className="text-sm text-muted-foreground">Doesn’t fit the remaining weeks: {cs.deferred.join(", ")}.</p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => post("accept", `/api/v1/plans/${data.pending!.id}/accept`, undefined, "The revised plan is now active.")}
              disabled={!!busy}
            >
              {busy === "accept" ? "Activating…" : "Accept changes"}
            </Button>
            <Button
              variant="outline"
              onClick={() => post("discard", `/api/v1/plans/${data.pending!.id}/discard`, undefined, "Kept your current plan.")}
              disabled={!!busy}
            >
              Keep my current plan
            </Button>
          </div>
        </Card>
      )}

      {!data.pending && data.planId && (
        <Card className="grid gap-3">
          <h2 className="font-semibold">Plan check</h2>
          {data.triggers.length ? (
            <ul className="grid gap-2 text-sm">
              {data.triggers.map((t) => (
                <li key={t.kind} className="flex gap-2">
                  <Badge tone="warning">{t.kind}</Badge>
                  <span>{t.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">You’re on track. Nothing in your progress calls for a change.</p>
          )}
          <Button
            variant={data.triggers.length ? "primary" : "outline"}
            onClick={() => post("replan", `/api/v1/plans/${data.planId}/replan`, {}, "A revised plan is ready to review above.")}
            disabled={!!busy}
            className="justify-self-start"
          >
            {busy === "replan" ? "Rebuilding the remaining weeks… (up to a minute)" : "Propose a revised plan"}
          </Button>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="grid gap-3">
          <h2 className="font-semibold">Log study time</h2>
          <Field label="Hours">
            <Input type="number" min={0.25} step={0.25} max={24} value={hours} onChange={(e) => setHours(e.target.value)} />
          </Field>
          <Field label="Skill (optional)">
            <Select value={hoursSkill} onChange={(e) => setHoursSkill(e.target.value)}>
              <option value="">General study</option>
              {data.skills.map((s) => (
                <option key={s.skillId} value={s.skillId}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            onClick={() =>
              post(
                "hours",
                "/api/v1/progress",
                { kind: "hours_logged", hours: Number(hours), ...(hoursSkill ? { skillId: hoursSkill } : {}) },
                "Hours logged.",
              ).then(() => setHours(""))
            }
            disabled={!!busy || !(Number(hours) > 0)}
          >
            Log hours
          </Button>
        </Card>

        <Card className="grid gap-3">
          <h2 className="font-semibold">Rate a skill</h2>
          <p className="text-sm text-muted-foreground">
            Self-ratings count, but less than checkpoint and interview scores.
          </p>
          <Field label="Skill">
            <Select value={rateSkill} onChange={(e) => setRateSkill(e.target.value)}>
              {data.skills.map((s) => (
                <option key={s.skillId} value={s.skillId}>
                  {s.name} (now {LEVELS[s.level]})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="How confident are you? (1-5)">
            <Input type="range" min={1} max={5} value={rating} onChange={(e) => setRating(Number(e.target.value))} />
          </Field>
          <Button
            onClick={() =>
              post("rate", "/api/v1/progress", { kind: "skill_level_changed", skillId: rateSkill, rating }, "Rating saved.")
            }
            disabled={!!busy || !rateSkill}
          >
            Save rating ({rating}/5)
          </Button>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold">Recent activity</h2>
        {data.events.length ? (
          <ul className="mt-3 grid gap-2 text-sm">
            {data.events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
                <span className="flex items-center gap-2">
                  <Badge>{KIND_LABEL[e.kind] ?? e.kind}</Badge>
                  {e.task ?? e.skill ?? e.note ?? ""}
                </span>
                <span className="text-muted-foreground">
                  {e.hours ? `${e.hours} h · ` : ""}
                  {e.value !== null && (e.kind === "interview_scored" || e.kind === "assessment_scored")
                    ? `${Math.round(e.value * 100)}% · `
                    : e.kind === "skill_level_changed" && e.value !== null
                      ? `${e.value}/5 · `
                      : ""}
                  {new Date(e.occurredAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No activity yet. Complete a task or log some study time.</p>
        )}
      </Card>
    </div>
  );
}

function DiffList({ title, tone, items }: { title: string; tone: "success" | "danger" | "warning"; items: string[] }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <h3 className="flex items-center justify-between font-semibold">
        {title} <Badge tone={tone}>{items.length}</Badge>
      </h3>
      <ul className="mt-2 grid gap-1 text-muted-foreground">
        {items.slice(0, 12).map((i) => (
          <li key={i}>{i}</li>
        ))}
        {items.length === 0 && <li>None</li>}
      </ul>
    </div>
  );
}
