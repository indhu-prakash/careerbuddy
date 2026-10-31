import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { CheckIcon, MicIcon, SparklesIcon, UploadIcon } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import type { FeatureId } from "@/features/catalog";
import { MockFrame } from "./MockFrame";

// Illustrative sample data only: these are static pictures of each module, not live output.

function Chip({ children, tone }: { children: ReactNode; tone: "success" | "warning" | "danger" | "primary" | "secondary" }) {
  return <Badge tone={tone}>{children}</Badge>;
}

function IntakeVisual() {
  return (
    <MockFrame title="careerbuddy · intake" label="Resume upload with extracted skills and a target role">
      <div className="grid place-items-center gap-1 rounded-xl border-2 border-dashed border-primary/40 bg-primary-soft/40 py-6 text-center">
        <UploadIcon className="size-6 text-primary" />
        <div className="text-sm font-medium">Drop your resume</div>
        <div className="text-xs text-muted-foreground">PDF, DOCX or TXT</div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
        <span>resume.pdf</span>
        <span className="inline-flex items-center gap-1 text-success">
          <CheckIcon className="size-4" /> Parsed
        </span>
      </div>
      <div className="mt-4 text-xs font-medium text-muted-foreground">Target role</div>
      <div className="mt-1 rounded-lg border border-border px-3 py-2 text-sm">Data Analyst → ML Engineer</div>
      <div className="mt-4 text-xs font-medium text-muted-foreground">Skills found</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["Python", "SQL", "Pandas", "Tableau", "Statistics", "A/B testing"].map((s) => (
          <Chip key={s} tone="primary">
            {s}
          </Chip>
        ))}
      </div>
    </MockFrame>
  );
}

function GapVisual() {
  const cols = [
    { title: "Matched", tone: "success" as const, items: ["Python", "SQL", "Pandas"] },
    { title: "Partial", tone: "warning" as const, items: ["Docker", "AWS"] },
    { title: "Missing", tone: "danger" as const, items: ["Kubernetes", "MLOps"] },
  ];
  return (
    <MockFrame title="careerbuddy · skill gap" label="Skill-gap map: 72 percent match with matched, partial and missing skills">
      <div className="flex items-center gap-4">
        <ScoreRing value={72} size={88} label="match" />
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-semibold">ML Engineer · 3 JDs</div>
          <div className="mt-1 text-muted-foreground">Kubernetes appears in 3 of 3 postings as required.</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {cols.map((c) => (
          <div key={c.title} className="rounded-lg border border-border p-2">
            <div className="text-xs font-semibold text-muted-foreground">{c.title}</div>
            <div className="mt-2 flex flex-col items-start gap-1.5">
              {c.items.map((s) => (
                <Chip key={s} tone={c.tone}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

function PlanVisual() {
  const weeks = [
    { w: 1, title: "Docker fundamentals", hours: 6, state: "done" },
    { w: 2, title: "Kubernetes core concepts", hours: 8, state: "active" },
    { w: 3, title: "CI/CD for ML models", hours: 7, state: "todo" },
    { w: 4, title: "Checkpoint: deploy a model", hours: 8, state: "todo" },
  ];
  return (
    <MockFrame title="careerbuddy · plan" label="Four-week learning plan with one week done and one in progress">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">Your 8-week plan</span>
        <Badge tone="secondary">8 h / week</Badge>
      </div>
      <ol className="mt-4 grid gap-3">
        {weeks.map((wk) => (
          <li key={wk.w} className="flex items-center gap-3">
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold",
                wk.state === "done" && "bg-success text-white dark:text-background",
                wk.state === "active" && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                wk.state === "todo" && "bg-muted text-muted-foreground",
              )}
            >
              {wk.state === "done" ? <CheckIcon className="size-4" /> : wk.w}
            </span>
            <div className="min-w-0 flex-1">
              <div className={cn("truncate text-sm font-medium", wk.state === "todo" && "text-muted-foreground")}>
                Week {wk.w}: {wk.title}
              </div>
              {wk.state === "active" && <ProgressBar value={45} className="mt-1.5 h-1.5" />}
            </div>
            <span className="text-xs text-muted-foreground">{wk.hours} h</span>
          </li>
        ))}
      </ol>
    </MockFrame>
  );
}

function ProjectsVisual() {
  const projects = [
    { title: "Churn model, served on Kubernetes", skills: ["Kubernetes", "Docker", "MLOps"], done: 2, total: 4 },
    { title: "Automated retraining pipeline", skills: ["CI/CD", "AWS"], done: 0, total: 3 },
  ];
  return (
    <MockFrame title="careerbuddy · portfolio" label="Two suggested portfolio projects with skills and milestones">
      <div className="grid gap-3">
        {projects.map((p, i) => (
          <div key={p.title} className={cn("rounded-xl border border-border p-3", i === 0 && "bg-primary-soft/40")}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold">{p.title}</div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {p.done}/{p.total}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.skills.map((s) => (
                <Chip key={s} tone="secondary">
                  {s}
                </Chip>
              ))}
            </div>
            <ProgressBar value={(p.done / p.total) * 100} tone="secondary" className="mt-3 h-1.5" />
          </div>
        ))}
        <div className="flex gap-2 rounded-lg bg-accent-soft p-3 text-xs text-accent-soft-foreground">
          <SparklesIcon className="size-4 shrink-0" />
          <span>Interview tip: lead with the 40% cut in retraining time.</span>
        </div>
      </div>
    </MockFrame>
  );
}

function InterviewVisual() {
  const rubric = [
    { name: "Correctness", score: 4 },
    { name: "Depth", score: 3 },
    { name: "Communication", score: 5 },
    { name: "Structure (STAR)", score: 4 },
  ];
  // Fixed waveform heights so server and client render the same.
  const wave = [30, 55, 80, 45, 95, 60, 35, 70, 90, 50, 40, 75, 85, 45, 30, 60, 50, 25];
  return (
    <MockFrame title="careerbuddy · mock interview" label="Mock interview answer scored 80 out of 100 across four rubric criteria">
      <div className="rounded-xl bg-muted p-3 text-sm">
        “Tell me about a time you learned a new technology quickly.”
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-danger text-white dark:text-background">
          <MicIcon className="size-4" />
        </span>
        <div className="flex h-8 flex-1 items-center gap-[3px]">
          {wave.map((h, i) => (
            <span key={i} className="flex-1 rounded-full bg-gradient-to-t from-primary to-secondary" style={{ height: `${h}%` }} />
          ))}
        </div>
        <span className="font-mono text-xs text-muted-foreground">1:24</span>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <ScoreRing value={80} size={76} suffix="" label="/ 100" />
        <ul className="grid flex-1 gap-2">
          {rubric.map((r) => (
            <li key={r.name} className="text-xs">
              <div className="flex justify-between">
                <span>{r.name}</span>
                <span className="text-muted-foreground">{r.score}/5</span>
              </div>
              <ProgressBar value={r.score * 20} className="mt-1 h-1.5" />
            </li>
          ))}
        </ul>
      </div>
    </MockFrame>
  );
}

function ProgressVisual() {
  const weeks = [
    { label: "W1", planned: 8, actual: 7 },
    { label: "W2", planned: 8, actual: 9 },
    { label: "W3", planned: 8, actual: 4 },
    { label: "W4", planned: 8, actual: 8 },
    { label: "W5", planned: 8, actual: 10 },
  ];
  return (
    <MockFrame title="careerbuddy · progress" label="Weekly hours chart with a plan adjustment notice">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">Hours logged</span>
        <span className="text-xs text-muted-foreground">target 8 h</span>
      </div>
      <div className="relative mt-4 flex h-32 items-end gap-3">
        {/* Target line at 8 of 10 hours. */}
        <div className="absolute inset-x-0 border-t border-dashed border-muted-foreground/50" style={{ bottom: "80%" }} />
        {weeks.map((w) => (
          <div key={w.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div
              className={cn(
                "w-full rounded-t-md",
                w.actual < w.planned * 0.75 ? "bg-warning" : "bg-gradient-to-t from-primary to-secondary",
              )}
              style={{ height: `${w.actual * 10}%` }}
            />
            <span className="text-[10px] text-muted-foreground">{w.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-primary/30 bg-primary-soft p-3 text-xs text-primary-soft-foreground">
        <span className="font-semibold">Plan adjusted:</span> W3 ran short, so Kubernetes gets one more week and MLOps moves to week 6.
      </div>
    </MockFrame>
  );
}

function TrackerVisual() {
  const sources = [
    { name: "Referral", rate: 40 },
    { name: "Company site", rate: 14 },
    { name: "Job board", rate: 6 },
  ];
  return (
    <MockFrame title="careerbuddy · applications" label="Response rate by source: referrals 40 percent, company site 14, job boards 6">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { k: "Applied", v: 24 },
          { k: "Replies", v: 5 },
          { k: "Interviews", v: 3 },
        ].map((s) => (
          <div key={s.k} className="rounded-lg bg-muted p-2">
            <div className="font-display text-xl font-bold">{s.v}</div>
            <div className="text-[11px] text-muted-foreground">{s.k}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-xs font-semibold text-muted-foreground">Response rate by source</div>
      <ul className="mt-2 grid gap-2.5">
        {sources.map((s) => (
          <li key={s.name} className="text-sm">
            <div className="flex justify-between">
              <span>{s.name}</span>
              <span className="font-medium">{s.rate}%</span>
            </div>
            <ProgressBar value={s.rate * 2} tone={s.rate > 20 ? "secondary" : "primary"} className="mt-1 h-2" />
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-2 rounded-lg bg-secondary-soft p-3 text-xs text-secondary-soft-foreground">
        <SparklesIcon className="size-4 shrink-0" />
        <span>Referrals reply roughly 6× more often. Ask for two this week.</span>
      </div>
    </MockFrame>
  );
}

export const FEATURE_VISUALS: Record<FeatureId, () => ReactNode> = {
  F1: IntakeVisual,
  F2: GapVisual,
  F3: PlanVisual,
  F4: ProjectsVisual,
  F5: InterviewVisual,
  F6: ProgressVisual,
  F7: TrackerVisual,
};
