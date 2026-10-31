"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Dashboard } from "@/lib/progress/dashboard";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScoreRing } from "@/components/ui/ScoreRing";

// Dates arrive as strings over the server -> client boundary.
type Data = Omit<Dashboard, never>;

const LEVELS = ["None", "Beginner", "Intermediate", "Advanced", "Expert"];

export function ProgressOverview({ data }: { data: Data }) {
  const apps = data.applications;
  const appTotal = Object.values(apps).reduce((a, b) => a + b, 0);
  const responded = (apps.screening ?? 0) + (apps.interviewing ?? 0) + (apps.offer ?? 0) + (apps.rejected ?? 0);

  return (
    <div className="grid gap-6">
      {!data.onboarded && (
        <Alert tone="info">
          Start by setting up your profile: resume, skills and target role.{" "}
          <a href="/onboarding" className="font-semibold underline">
            Set up my profile
          </a>
        </Alert>
      )}

      {data.pendingReplan && (
        <Alert tone="warning">
          A revised plan is waiting for your review: {data.pendingReplan.reason}{" "}
          <a href="/progress" className="font-semibold underline">
            Review changes
          </a>
        </Alert>
      )}
      {!data.pendingReplan && data.triggers.length > 0 && data.plan && (
        <Alert tone="warning">
          {data.triggers.map((t) => t.reason).join(" ")}{" "}
          <a href="/progress" className="font-semibold underline">
            Propose a revised plan
          </a>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4">
          <ScoreRing value={(data.readiness ?? 0) * 100} size={84} label="ready" />
          <div className="text-sm">
            <div className="font-semibold">Readiness</div>
            <div className="text-muted-foreground">
              {data.analysis ? `for ${data.analysis.targetRole ?? "your target role"}` : "Run a gap analysis first"}
            </div>
          </div>
        </Card>
        <Stat label="Learning streak" value={`${data.streakDays} day${data.streakDays === 1 ? "" : "s"}`} />
        <Stat
          label="Plan progress"
          value={data.plan ? `${data.plan.tasksDone}/${data.plan.tasksTotal} tasks` : "No plan yet"}
          sub={data.plan ? `Week ${data.plan.currentWeek} of ${data.plan.durationWeeks}` : undefined}
        />
        <Stat
          label="Applications"
          value={`${appTotal}`}
          sub={appTotal ? `${responded} got a response` : "Track them in Applications"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Study hours per week</h2>
          {data.plan && (
            <p className="text-sm text-muted-foreground">
              {data.plan.hoursSpent} of {data.plan.hoursPlanned} planned hours done
            </p>
          )}
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.hoursByWeek.map((w) => ({ week: w.weekStart.slice(5), hours: w.hours }))}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="week" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={28} />
                <Tooltip
                  formatter={(v) => `${v} h`}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="hours" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold">Skill levels vs required</h2>
          {data.analysis ? (
            <ul className="mt-3 grid gap-3 text-sm">
              {data.analysis.skills.map((s) => (
                <li key={s.name}>
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground">
                      {LEVELS[s.level]} / {LEVELS[s.requiredLevel]}
                    </span>
                  </div>
                  <ProgressBar value={Math.min(100, (s.level / Math.max(1, s.requiredLevel)) * 100)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Your skills appear here after a gap analysis.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Up next</h2>
            {data.plan && (
              <ButtonLink href="/plan" variant="ghost" size="sm">
                Open plan
              </ButtonLink>
            )}
          </div>
          {data.plan?.nextTasks.length ? (
            <ul className="mt-3 grid gap-2 text-sm">
              {data.plan.nextTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                  <span className="min-w-0 truncate">{t.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    W{t.weekNumber} · {t.estHours} h
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {data.plan ? "All caught up." : "Build a learning plan from your gap map to see tasks here."}
            </p>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Recent mock interviews</h2>
            <ButtonLink href="/interview" variant="ghost" size="sm">
              Practice
            </ButtonLink>
          </div>
          {data.interviews.length ? (
            <ul className="mt-3 grid gap-2 text-sm">
              {data.interviews.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <a href={`/interview/${s.id}`} className="hover:underline">
                    {new Date(s.createdAt).toLocaleDateString()} · {s.kind.replace("_", " ")}
                  </a>
                  <Badge tone={(s.overallScore ?? 0) >= 70 ? "success" : (s.overallScore ?? 0) >= 50 ? "warning" : "danger"}>
                    {Math.round(s.overallScore ?? 0)}/100
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No completed interviews yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
      {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
    </Card>
  );
}
