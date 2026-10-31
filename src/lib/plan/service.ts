import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { loadGapContext, type GapContext } from "@/lib/analysis/load";
import { runAiTask } from "@/lib/ai/service";
import { buildPrompt, PlanWeekTextSchema, PROMPT_VERSION, SYSTEM, type WeekSkeleton } from "@/lib/ai/prompts/plan-week";
import { fitMilestones, readSpec } from "@/lib/projects/milestones";
import { checkCoverage, scheduleLearning, type ScheduleResult, type Tier } from "@/lib/scoring/schedule";
import {
  addDays,
  fallbackWeekText,
  gapKey,
  gapsFromContext,
  pickResource,
  PLAN_SLACK,
  PROJECT_SHARE,
  taskTitle,
  todayUtc,
  type ResourceRow,
} from "./build";

// Remote Postgres round trips add up; the default 5 s interactive-transaction timeout is tight.
export const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

export class PlanInputError extends Error {
  constructor(readonly code: "no_gaps") {
    super(code);
  }
}

export type CreatePlanInput = {
  gapAnalysisId?: string;
  weeks?: number;
  hoursPerWeek?: number;
  /** Why this version exists (F6 replans pass their trigger). */
  reason?: string;
  /** Replan: hours already done per skill id, trimmed from the new schedule. */
  doneHours?: Record<string, number>;
  /** Replan (F6): save as a draft revision of this active plan instead of replacing it. */
  draftOf?: string;
  /** Replan: skills already at the required level, left out of the new version. */
  dropSkillIds?: string[];
  /** Replan: weak skills, scheduled first with one extra level of reinforcement work. */
  boostSkillIds?: string[];
};

const REINFORCEMENT_HOURS = 10;

/** Gap list for the scheduler, with replan adjustments for mastered and weak skills. */
function plannedGaps(ctx: GapContext, input: CreatePlanInput) {
  const drop = new Set(input.dropSkillIds ?? []);
  const boost = new Set(input.boostSkillIds ?? []);
  const gaps = gapsFromContext(ctx.items).filter((g) => !drop.has(g.skillId));
  const out = gaps.map((g) =>
    boost.has(g.skillId)
      ? { ...g, priority: (g.priority ?? 0.5) * 2 + 1, effortHours: (g.effortHours ?? REINFORCEMENT_HOURS) + REINFORCEMENT_HOURS }
      : g,
  );
  // A weak skill the analysis counted as matched still gets reinforcement work.
  for (const i of ctx.items) {
    const key = gapKey(i);
    if (!boost.has(key) || drop.has(key) || out.some((g) => g.skillId === key)) continue;
    const current = i.currentLevel ?? 1;
    out.push({
      skillId: key,
      name: i.skill?.name ?? i.skillName,
      demand: i.demand,
      gap: Math.max(0.1, i.demand * 0.5),
      have: 0.5,
      category: i.category,
      priority: 1 + i.demand,
      currentLevel: current,
      requiredLevel: Math.max(i.requiredLevel ?? 2, current + 1),
      effortHours: REINFORCEMENT_HOURS,
      skillCategory: i.skill?.category ?? null,
    });
  }
  return out;
}

/**
 * Schedule a plan from a saved gap analysis and save it as the user's active plan.
 * Code builds the skeleton (scheduler + curated resources); one AI call writes the
 * week text, falling back to template text if the AI is unavailable or over budget.
 * Returns null when the gap analysis doesn't exist for this user.
 */
export async function createPlan(userId: string, input: CreatePlanInput) {
  const ctx = await loadGapContext(userId, input.gapAnalysisId);
  if (!ctx) return null;
  const gaps = plannedGaps(ctx, input);
  if (!gaps.length) throw new PlanInputError("no_gaps");

  const weeks = input.weeks ?? ctx.budget.weeks;
  const hoursPerWeek = input.hoursPerWeek ?? ctx.budget.hoursPerWeek;
  const graph = await loadSkillGraph(userId, ctx);
  const schedule = scheduleLearning({
    gaps,
    prereqs: graph.prereqs,
    skillInfo: graph.skillInfo,
    known: graph.known,
    weeks,
    hoursPerWeek,
    doneHours: input.doneHours,
    slack: PLAN_SLACK,
    projectShare: PROJECT_SHARE,
  });

  const skillIds = schedule.skills.map((s) => s.skillId).filter((id) => !id.startsWith("name:"));
  const [resources, topics] = await Promise.all([
    db.learningResource.findMany({
      where: { skillId: { in: skillIds }, curated: true },
      orderBy: { title: "asc" },
      select: { id: true, skillId: true, title: true, url: true, kind: true, tier: true },
    }),
    db.skillTopic.findMany({
      where: { skillId: { in: skillIds } },
      orderBy: [{ tier: "asc" }, { position: "asc" }],
      select: { skillId: true, tier: true, title: true },
    }),
  ]);
  const draft = draftWeeks(schedule, resources, topics);
  const { texts, source } = await writeWeekText(userId, ctx.targetRole?.title ?? null, draft);

  // The version this one replaces: the plan being revised, else the latest for the analysis.
  const previous = await db.learningPlan.findFirst({
    where: input.draftOf ? { id: input.draftOf, userId } : { userId, gapAnalysisId: ctx.id },
    orderBy: { version: "desc" },
    select: { id: true, version: true, durationWeeks: true, hoursPerWeek: true, weeks: { select: { content: true } } },
  });
  const plannedNames = schedule.skills.map((s) => s.name);
  const changeSummary = previous
    ? diffSkills(
        previous.weeks.flatMap((w) => weekSkills(w.content).map((s) => s.name)),
        plannedNames,
        { weeks: [previous.durationWeeks, weeks], hoursPerWeek: [previous.hoursPerWeek, hoursPerWeek] },
      )
    : undefined;

  const start = todayUtc();
  const isDraft = !!input.draftOf;
  const plan = await db.$transaction(async (tx) => {
    if (isDraft) {
      // One pending proposal per plan: a new one replaces the old.
      await tx.learningPlan.deleteMany({ where: { userId, parentId: input.draftOf, status: "draft" } });
    } else {
      await tx.learningPlan.updateMany({ where: { userId, status: "active" }, data: { status: "superseded" } });
    }
    const latest = await tx.learningPlan.findFirst({
      where: { gapAnalysisId: ctx.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const created = await tx.learningPlan.create({
      data: {
        userId,
        gapAnalysisId: ctx.id,
        parentId: input.draftOf ?? previous?.id ?? null,
        version: Math.max(previous?.version ?? 0, latest?.version ?? 0) + 1,
        status: isDraft ? "draft" : "active",
        durationWeeks: weeks,
        hoursPerWeek,
        reason: input.reason ?? (previous ? "Regenerated by the user" : null),
        changeSummary,
        startDate: start,
        weeks: {
          create: draft.map((w, i) => {
            const text = texts.get(w.weekNumber) ?? fallbackWeekText(w.skills);
            const weekStart = addDays(start, i * 7);
            return {
              weekNumber: w.weekNumber,
              goal: text.goal,
              objectives: text.objectives,
              checkpoint: text.checkpoint,
              startDate: weekStart,
              content: {
                exercises: text.exercises,
                skills: w.skills.map(({ key, skillId, name, tier, hours }) => ({ key, skillId, name, tier, hours })),
                resources: w.resources,
                textSource: texts.has(w.weekNumber) ? source : "template",
              } satisfies WeekContent,
            };
          }),
        },
      },
      select: { id: true, weeks: { select: { id: true, weekNumber: true } } },
    });
    // One bulk insert for the tasks keeps the transaction to a handful of round trips.
    const weekId = new Map(created.weeks.map((w) => [w.weekNumber, w.id]));
    await tx.planTask.createMany({
      data: draft.flatMap((w, i) =>
        w.tasks.map((t, position) => ({
          ...t,
          weekId: weekId.get(w.weekNumber)!,
          userId,
          position,
          dueDate: addDays(start, i * 7 + 6),
        })),
      ),
    });

    // Drafts get their milestones when accepted, so the active plan keeps them meanwhile.
    if (!isDraft) await refitProjects(tx, userId, ctx.id, created.id);
    return created;
  }, TX_OPTIONS);

  return getPlan(userId, plan.id);
}

/** Projects already suggested for this analysis follow the plan to its new version. */
export async function refitProjects(
  tx: Prisma.TransactionClient,
  userId: string,
  gapAnalysisId: string,
  planId: string,
) {
  const projects = await tx.portfolioProject.findMany({
    where: { userId, gapAnalysisId, status: { in: ["suggested", "in_progress"] } },
    select: { id: true, title: true, spec: true },
  });
  const withSpec = projects.flatMap((p) => {
    const spec = readSpec(p.spec);
    return spec ? [{ id: p.id, title: p.title, spec, skillIds: spec.skillKeys.filter((k) => !k.startsWith("name:")) }] : [];
  });
  if (withSpec.length) await fitMilestones(tx, { userId, planId, projects: withSpec });
}

/** Prereq edges, names for pullable prerequisites, and skills the user already has. */
async function loadSkillGraph(userId: string, ctx: GapContext) {
  const [edges, userSkills] = await Promise.all([
    db.skillEdge.findMany({
      where: { kind: "prereq" },
      select: { fromSkillId: true, toSkillId: true, from: { select: { name: true, category: true } } },
    }),
    db.userSkill.findMany({ where: { userId, level: { gte: 1 } }, select: { skillId: true } }),
  ]);
  const skillInfo: Record<string, { name: string; category: string | null }> = {};
  for (const e of edges) skillInfo[e.fromSkillId] = { name: e.from.name, category: e.from.category };
  const known = new Set(userSkills.map((s) => s.skillId));
  for (const i of ctx.items) if (i.status === "matched" && i.skillId) known.add(i.skillId);
  return { prereqs: edges.map((e) => ({ from: e.fromSkillId, to: e.toSkillId })), skillInfo, known };
}

type WeekContent = {
  exercises: string[];
  skills: { key: string; skillId: string | null; name: string; tier: Tier; hours: number }[];
  resources: { title: string; url: string; kind: string; skill: string }[];
  textSource: "ai" | "template";
};

function weekSkills(content: unknown): WeekContent["skills"] {
  const skills = (content as Partial<WeekContent> | null)?.skills;
  return Array.isArray(skills) ? skills : [];
}

/** Turn the scheduler result into week rows with titled tasks and curated resources. */
function draftWeeks(
  schedule: ScheduleResult,
  resources: ResourceRow[],
  topics: { skillId: string; tier: Tier; title: string }[],
) {
  const names = new Map(schedule.skills.map((s) => [s.skillId, s.name]));
  const topicsFor = (skillId: string, tier: Tier) =>
    topics.filter((t) => t.skillId === skillId && t.tier === tier).map((t) => t.title);

  return schedule.weeks.map((w) => {
    const skills = new Map<string, WeekContent["skills"][number] & { topics: string[]; tasks: { kind: string; hours: number }[] }>();
    const weekResources = new Map<string, WeekContent["resources"][number]>();
    const tasks = w.tasks.map((t) => {
      const name = names.get(t.skillId) ?? t.skillId;
      const catalogId = t.skillId.startsWith("name:") ? null : t.skillId;
      const tierTopics = catalogId ? topicsFor(catalogId, t.tier) : [];
      const entry = skills.get(t.skillId) ?? {
        key: t.skillId,
        skillId: catalogId,
        name,
        tier: t.tier,
        hours: 0,
        topics: [],
        tasks: [],
      };
      entry.hours += t.estHours;
      entry.tasks.push({ kind: t.kind, hours: t.estHours });
      for (const topic of t.kind === "assessment" ? [] : tierTopics) if (!entry.topics.includes(topic)) entry.topics.push(topic);
      skills.set(t.skillId, entry);

      const resource =
        t.kind === "learn" && catalogId ? pickResource(resources.filter((r) => r.skillId === catalogId), t.tier, t.part) : null;
      if (resource) weekResources.set(resource.url, { title: resource.title, url: resource.url, kind: resource.kind, skill: name });
      return {
        skillId: catalogId,
        resourceId: resource?.id ?? null,
        kind: t.kind,
        title: taskTitle(t, name, tierTopics),
        estHours: t.estHours,
      };
    });
    return { weekNumber: w.weekNumber, hours: w.hours, tasks, skills: [...skills.values()], resources: [...weekResources.values()] };
  });
}

type WeekText = { goal: string; objectives: string[]; exercises: string[]; checkpoint: string };

/** One AI call for all weeks. Any AI failure falls back to template text (logged). */
async function writeWeekText(
  userId: string,
  targetRole: string | null,
  draft: ReturnType<typeof draftWeeks>,
): Promise<{ texts: Map<number, WeekText>; source: "ai" | "template" }> {
  const skeleton: WeekSkeleton[] = draft.map((w) => ({
    weekNumber: w.weekNumber,
    hours: w.hours,
    skills: w.skills.map((s) => ({ name: s.name, tier: s.tier, topics: s.topics.slice(0, 6), tasks: s.tasks })),
  }));
  try {
    const { data } = await runAiTask({
      task: "plan.weeks",
      promptVersion: PROMPT_VERSION,
      userId,
      system: SYSTEM,
      prompt: buildPrompt({ targetRole, weeks: skeleton }),
      schema: PlanWeekTextSchema,
      effort: "low",
      // Reasoning tokens count against max_tokens on reasoning models, so leave headroom.
      maxTokens: Math.min(16000, 6000 + 800 * draft.length),
    });
    const known = new Set(draft.map((w) => w.weekNumber));
    const texts = new Map<number, WeekText>();
    for (const w of data.weeks) {
      if (!known.has(w.weekNumber) || texts.has(w.weekNumber) || !w.goal.trim()) continue;
      texts.set(w.weekNumber, {
        goal: w.goal.trim(),
        objectives: w.objectives.map((o) => o.trim()).filter(Boolean).slice(0, 5),
        exercises: w.exercises.map((e) => e.trim()).filter(Boolean).slice(0, 4),
        checkpoint: w.checkpoint.trim(),
      });
    }
    return { texts, source: "ai" };
  } catch (error) {
    console.warn("[plan] week text fell back to template", error);
    return { texts: new Map(), source: "template" };
  }
}

function diffSkills(before: string[], after: string[], extra: Record<string, [number, number]>) {
  const b = new Set(before);
  const a = new Set(after);
  return {
    addedSkills: [...a].filter((s) => !b.has(s)),
    removedSkills: [...b].filter((s) => !a.has(s)),
    ...Object.fromEntries(Object.entries(extra).map(([k, [from, to]]) => [k, { from, to }])),
  } satisfies Prisma.InputJsonValue;
}

const PLAN_SELECT = {
  id: true,
  gapAnalysisId: true,
  parentId: true,
  version: true,
  status: true,
  durationWeeks: true,
  hoursPerWeek: true,
  reason: true,
  changeSummary: true,
  startDate: true,
  createdAt: true,
  weeks: {
    orderBy: { weekNumber: "asc" },
    select: {
      id: true,
      weekNumber: true,
      goal: true,
      objectives: true,
      content: true,
      checkpoint: true,
      startDate: true,
      tasks: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          kind: true,
          position: true,
          title: true,
          resourceUrl: true,
          estHours: true,
          hoursSpent: true,
          status: true,
          score: true,
          dueDate: true,
          completedAt: true,
          skill: { select: { id: true, slug: true, name: true } },
          resource: { select: { title: true, url: true, kind: true, tier: true } },
        },
      },
    },
  },
  projects: { select: { id: true, title: true, status: true } },
} satisfies Prisma.LearningPlanSelect;

/**
 * One plan with weeks and tasks, plus totals, the top-5 coverage check and the gaps
 * that didn't fit (both recomputed from the gap analysis). Null if not the user's.
 */
export async function getPlan(userId: string, planId: string) {
  const plan = await db.learningPlan.findFirst({ where: { id: planId, userId }, select: PLAN_SELECT });
  if (!plan) return null;

  const ctx = await loadGapContext(userId, plan.gapAnalysisId);
  const gaps = ctx ? gapsFromContext(ctx.items) : [];
  const planned = new Set(plan.weeks.flatMap((w) => weekSkills(w.content).map((s) => s.key)));
  const coverage = checkCoverage(gaps, planned);
  const deferred = gaps.filter((g) => !planned.has(g.skillId)).map((g) => ({ skillId: g.skillId, name: g.name }));

  const tasks = plan.weeks.flatMap((w) => w.tasks);
  const active = tasks.filter((t) => t.status !== "skipped");
  return {
    ...plan,
    weeks: plan.weeks.map((w) => ({ ...w, plannedHours: w.tasks.reduce((n, t) => n + t.estHours, 0) })),
    targetRole: ctx?.targetRole?.title ?? null,
    totals: {
      tasks: tasks.length,
      done: tasks.filter((t) => t.status === "done").length,
      plannedHours: active.reduce((n, t) => n + t.estHours, 0),
      hoursSpent: tasks.reduce((n, t) => n + t.hoursSpent, 0),
    },
    coverage,
    deferred,
  };
}

export type PlanDetail = NonNullable<Awaited<ReturnType<typeof getPlan>>>;

export async function getActivePlan(userId: string) {
  const active = await db.learningPlan.findFirst({
    where: { userId, status: "active" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return active ? getPlan(userId, active.id) : null;
}

/** The user's plans, newest first, with task progress counts. */
export async function listPlans(userId: string) {
  const plans = await db.learningPlan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      gapAnalysisId: true,
      parentId: true,
      version: true,
      status: true,
      durationWeeks: true,
      hoursPerWeek: true,
      reason: true,
      startDate: true,
      createdAt: true,
    },
  });
  // groupBy can't group by a relation field (week.planId), so count in code.
  const tasks = await db.planTask.findMany({
    where: { userId, week: { planId: { in: plans.map((p) => p.id) } } },
    select: { status: true, week: { select: { planId: true } } },
  });
  const counts = new Map<string, { total: number; done: number }>();
  for (const t of tasks) {
    const c = counts.get(t.week.planId) ?? { total: 0, done: 0 };
    c.total++;
    if (t.status === "done") c.done++;
    counts.set(t.week.planId, c);
  }
  return plans.map((p) => ({ ...p, tasks: counts.get(p.id) ?? { total: 0, done: 0 } }));
}
