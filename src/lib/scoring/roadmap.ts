// Roadmap (journey + plan timeline). Pure functions over facts loaded from saved rows,
// so the stage rules and the "next best action" are unit-testable without a database.

export const JOB_READY_THRESHOLD = 0.8;
/** Interviews count as done after this many completed sessions at this average (0..100). */
export const INTERVIEWS_TARGET = 3;
export const INTERVIEW_PASS_AVG = 70;
/** Assessment score (0..1) that passes a week's checkpoint; matches progress/review. */
export const CHECKPOINT_PASS = 0.6;

export type StageKey = "profile" | "gap_map" | "plan" | "projects" | "interviews" | "applications" | "job_ready";
export type StageStatus = "done" | "in_progress" | "next" | "locked";

export type RoadmapFacts = {
  profile: {
    hasResume: boolean;
    skills: number;
    reviewedSkills: number;
    targetRole: string | null;
    hoursPerWeek: number | null;
    onboarded: boolean;
  };
  /** Latest gap analysis; matchScore 0..1 at analysis time. */
  analysis: { id: string; matchScore: number; targetRole: string | null } | null;
  plan: { id: string; currentWeek: number; durationWeeks: number; tasksDone: number; tasksTotal: number } | null;
  /** Projects for the latest analysis (dropped ones excluded from the counts). */
  projects: { suggested: number; inProgress: number; done: number };
  interviews: { completed: number; avgScore: number | null };
  applications: { total: number; responses: number; offers: number };
  /** Current readiness 0..1 (latest gap map recomputed with current levels). */
  readiness: number | null;
};

export type Stage = {
  key: StageKey;
  title: string;
  href: string;
  status: StageStatus;
  metric: string;
  /** Short instruction for what to do at this stage. */
  action: string;
  /** "Build my roadmap" can complete this stage without the user. */
  automatable: boolean;
};

const TITLES: Record<StageKey, { title: string; href: string }> = {
  profile: { title: "Profile", href: "/onboarding" },
  gap_map: { title: "Gap map", href: "/gap-map" },
  plan: { title: "Learning plan", href: "/plan" },
  projects: { title: "Portfolio projects", href: "/projects" },
  interviews: { title: "Mock interviews", href: "/interview" },
  applications: { title: "Applications", href: "/applications" },
  job_ready: { title: "Job-ready", href: "/progress" },
};

export const STAGE_ORDER: StageKey[] = ["profile", "gap_map", "plan", "projects", "interviews", "applications", "job_ready"];

const pct = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function profileComplete(p: RoadmapFacts["profile"]): boolean {
  return p.hasResume && p.skills > 0 && (p.reviewedSkills > 0 || p.onboarded) && !!p.targetRole && !!p.hoursPerWeek;
}

function profileStage(p: RoadmapFacts["profile"]): Pick<Stage, "status" | "metric" | "action"> {
  if (profileComplete(p)) {
    return {
      status: "done",
      metric: `${p.targetRole} · ${plural(p.skills, "skill")} · ${p.hoursPerWeek} h/week`,
      action: "Update your profile",
    };
  }
  const missing = [
    !p.hasResume && "resume",
    (p.skills === 0 || (p.reviewedSkills === 0 && !p.onboarded)) && "skill review",
    !p.targetRole && "target role",
    !p.hoursPerWeek && "weekly hours",
  ].filter(Boolean) as string[];
  const started = p.hasResume || p.skills > 0 || !!p.targetRole;
  return {
    status: started ? "in_progress" : "next",
    metric: `Missing: ${missing.join(", ")}`,
    action: started ? "Finish your profile" : "Set up your profile",
  };
}

/** Status and metric for every journey stage, in order. */
export function computeStages(f: RoadmapFacts): Stage[] {
  const profileDone = profileComplete(f.profile);
  const hasAnalysis = !!f.analysis;
  const projectsTotal = f.projects.suggested + f.projects.inProgress + f.projects.done;

  // A stage with saved data is never shown as locked, whatever its prerequisites.
  const open = (unlocked: boolean): StageStatus => (unlocked ? "next" : "locked");

  const out: Record<StageKey, Pick<Stage, "status" | "metric" | "action">> = {
    profile: profileStage(f.profile),
    gap_map: f.analysis
      ? {
          status: "done",
          metric: `Match ${pct(f.analysis.matchScore)}${f.analysis.targetRole ? ` for ${f.analysis.targetRole}` : ""}`,
          action: "Re-run with new job descriptions",
        }
      : {
          status: open(profileDone),
          metric: profileDone ? "Paste 1-5 job descriptions to map your gaps" : "Needs a complete profile",
          action: "Map your skill gaps",
        },
    plan: f.plan
      ? {
          status: f.plan.tasksTotal > 0 && f.plan.tasksDone >= f.plan.tasksTotal ? "done" : "in_progress",
          metric: `${f.plan.currentWeek > 0 ? `Week ${f.plan.currentWeek} of ${f.plan.durationWeeks}` : `Starts soon · ${f.plan.durationWeeks} weeks`} · ${f.plan.tasksDone}/${f.plan.tasksTotal} tasks`,
          action: f.plan.currentWeek > 0 ? `Continue week ${f.plan.currentWeek} of your plan` : "Start your plan",
        }
      : {
          status: open(hasAnalysis),
          metric: hasAnalysis ? "Ready to generate from your gap map" : "Needs a gap map",
          action: "Create your learning plan",
        },
    projects:
      projectsTotal > 0
        ? {
            status: f.projects.done > 0 ? "done" : "in_progress",
            metric: projectMetric(f.projects, projectsTotal),
            action: f.projects.inProgress > 0 ? "Keep building your project" : "Pick a project and start it",
          }
        : {
            status: open(hasAnalysis),
            metric: hasAnalysis ? "Ready to suggest projects for your gaps" : "Needs a gap map",
            action: "Get project suggestions",
          },
    interviews:
      f.interviews.completed > 0
        ? {
            status:
              f.interviews.completed >= INTERVIEWS_TARGET && (f.interviews.avgScore ?? 0) >= INTERVIEW_PASS_AVG
                ? "done"
                : "in_progress",
            metric: `${plural(f.interviews.completed, "interview")}${f.interviews.avgScore !== null ? `, avg ${Math.round(f.interviews.avgScore)}` : ""}`,
            action: "Practice another mock interview",
          }
        : {
            status: open(profileDone),
            metric: profileDone ? "No interviews yet" : "Needs a complete profile",
            action: "Practice a mock interview",
          },
    applications:
      f.applications.total > 0
        ? {
            status: f.applications.offers > 0 ? "done" : "in_progress",
            metric: `${plural(f.applications.total, "application")}, ${plural(f.applications.responses, "response")}${f.applications.offers ? `, ${plural(f.applications.offers, "offer")}` : ""}`,
            action: "Track your applications",
          }
        : {
            status: open(profileDone),
            metric: profileDone ? "No applications logged yet" : "Needs a complete profile",
            action: "Log your first application",
          },
    job_ready:
      f.readiness === null
        ? { status: "locked", metric: "Needs a gap map", action: "Map your skill gaps" }
        : {
            status: f.readiness >= JOB_READY_THRESHOLD ? "done" : "in_progress",
            metric: `Readiness ${pct(f.readiness)} · goal ${pct(JOB_READY_THRESHOLD)}`,
            action: "Close your remaining gaps",
          },
  };

  return STAGE_ORDER.map((key) => ({
    key,
    ...TITLES[key],
    ...out[key],
    automatable: (key === "plan" && !f.plan && hasAnalysis) || (key === "projects" && projectsTotal === 0 && hasAnalysis),
  }));
}

function projectMetric(p: RoadmapFacts["projects"], total: number): string {
  const parts = [plural(total, "project")];
  if (p.inProgress) parts.push(`${p.inProgress} in progress`);
  if (p.done) parts.push(`${p.done} done`);
  if (!p.inProgress && !p.done) parts.push("not started");
  return parts.join(", ");
}

/**
 * The single next best action. Setup stages come first in journey order; once a plan and
 * projects exist, interviews start halfway through the plan (or at 60% readiness) and
 * applications at 70% readiness; otherwise keep working the plan.
 */
export function nextBestAction(stages: Stage[], f: RoadmapFacts): StageKey | null {
  const by = new Map(stages.map((s) => [s.key, s]));
  const pending = (k: StageKey) => {
    const s = by.get(k);
    return !!s && s.status !== "done" && s.status !== "locked";
  };
  const notStarted = (k: StageKey) => by.get(k)?.status === "next";

  if (pending("profile")) return "profile";
  if (pending("gap_map")) return "gap_map";
  if (notStarted("plan")) return "plan";
  if (notStarted("projects")) return "projects";

  const planShare = f.plan && f.plan.tasksTotal > 0 ? f.plan.tasksDone / f.plan.tasksTotal : 0;
  const readiness = f.readiness ?? 0;
  if (notStarted("interviews") && (planShare >= 0.5 || readiness >= 0.6 || !pending("plan"))) return "interviews";
  if (notStarted("applications") && (readiness >= 0.7 || !pending("plan"))) return "applications";
  if (pending("plan")) return "plan";

  const rest = STAGE_ORDER.filter((k) => k !== "job_ready" && pending(k));
  return rest[0] ?? null;
}

// ───────────────────────────── plan timeline ─────────────────────────────

export type TimelineTaskInput = {
  id: string;
  title: string;
  kind: string;
  status: string;
  estHours: number;
  hoursSpent: number;
  score: number | null;
};

export type TimelineWeekInput = {
  weekNumber: number;
  goal: string;
  checkpoint: string | null;
  content: unknown;
  tasks: TimelineTaskInput[];
};

export type CheckpointStatus = "passed" | "failed" | "pending" | "none";
export type WeekState = "past" | "current" | "upcoming";

export type TimelineWeek = {
  weekNumber: number;
  goal: string;
  state: WeekState;
  skills: string[];
  tasksDone: number;
  tasksTotal: number;
  hoursSpent: number;
  hoursPlanned: number;
  checkpoint: { text: string | null; status: CheckpointStatus };
  milestones: { id: string; title: string; status: string }[];
  /** Tasks left undone in a week that has passed (status missed, or still todo/doing). */
  missed: { id: string; title: string }[];
};

const round1 = (x: number) => Math.round(x * 10) / 10;

function contentSkills(content: unknown): string[] {
  const skills = (content as { skills?: unknown } | null)?.skills;
  if (!Array.isArray(skills)) return [];
  const names = skills.map((s) => (s as { name?: unknown })?.name).filter((n): n is string => typeof n === "string" && !!n);
  return [...new Set(names)];
}

/** Week-by-week view of a plan; `current` is the 1-based current week (0 before it starts). */
export function buildTimeline(weeks: TimelineWeekInput[], current: number): TimelineWeek[] {
  return weeks.map((w) => {
    const state: WeekState = w.weekNumber < current ? "past" : w.weekNumber === current ? "current" : "upcoming";
    const counted = w.tasks.filter((t) => t.status !== "skipped");
    const assessments = w.tasks.filter((t) => t.kind === "assessment" && t.status !== "skipped");
    const scored = assessments.filter((t) => t.score !== null);
    const checkpoint: CheckpointStatus =
      assessments.length === 0
        ? "none"
        : scored.length < assessments.length
          ? state === "past" && scored.some((t) => t.score! < CHECKPOINT_PASS)
            ? "failed"
            : "pending"
          : scored.every((t) => t.score! >= CHECKPOINT_PASS)
            ? "passed"
            : "failed";
    return {
      weekNumber: w.weekNumber,
      goal: w.goal,
      state,
      skills: contentSkills(w.content),
      tasksDone: counted.filter((t) => t.status === "done").length,
      tasksTotal: counted.length,
      hoursSpent: round1(w.tasks.reduce((n, t) => n + t.hoursSpent, 0)),
      hoursPlanned: round1(counted.reduce((n, t) => n + t.estHours, 0)),
      checkpoint: { text: w.checkpoint, status: checkpoint },
      milestones: w.tasks
        .filter((t) => t.kind === "project_milestone")
        .map((t) => ({ id: t.id, title: t.title, status: t.status })),
      missed:
        state === "past"
          ? w.tasks
              .filter((t) => t.status === "missed" || t.status === "todo" || t.status === "doing")
              .map((t) => ({ id: t.id, title: t.title }))
          : w.tasks.filter((t) => t.status === "missed").map((t) => ({ id: t.id, title: t.title })),
    };
  });
}
