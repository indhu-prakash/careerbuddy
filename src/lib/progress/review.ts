import "server-only";
import { db } from "@/lib/db";
import { evaluateTriggers, type SkillState, type Trigger, type WeekProgress } from "@/lib/scoring/replan";

const PASS_SCORE = 0.6;
const DAY = 86_400_000;

/** The active plan with everything the review and dashboard need. */
export async function loadActivePlan(userId: string) {
  return db.learningPlan.findFirst({
    where: { userId, status: "active" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      version: true,
      startDate: true,
      durationWeeks: true,
      hoursPerWeek: true,
      gapAnalysisId: true,
      weeks: {
        orderBy: { weekNumber: "asc" },
        select: {
          weekNumber: true,
          goal: true,
          tasks: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              title: true,
              kind: true,
              status: true,
              estHours: true,
              hoursSpent: true,
              score: true,
              dueDate: true,
              skillId: true,
              skill: { select: { name: true } },
            },
          },
        },
      },
    },
  });
}

export type ActivePlan = NonNullable<Awaited<ReturnType<typeof loadActivePlan>>>;

/** 1-based week of the plan that contains `now` (0 before it starts). */
export function currentWeek(plan: { startDate: Date; durationWeeks: number }, now = new Date()): number {
  const elapsed = now.getTime() - plan.startDate.getTime();
  if (elapsed < 0) return 0;
  return Math.min(plan.durationWeeks, Math.floor(elapsed / (7 * DAY)) + 1);
}

export function weekProgress(plan: ActivePlan, now = new Date()): WeekProgress[] {
  return plan.weeks.map((w) => {
    const scored = w.tasks.filter((t) => t.kind === "assessment" && t.score !== null);
    return {
      weekNumber: w.weekNumber,
      plannedHours: sum(w.tasks.map((t) => t.estHours)),
      actualHours: sum(w.tasks.map((t) => t.hoursSpent)),
      ended: plan.startDate.getTime() + w.weekNumber * 7 * DAY <= now.getTime(),
      checkpointsPassed: scored.length ? scored.every((t) => t.score! >= PASS_SCORE) : null,
    };
  });
}

/** Per-skill state for the skills this plan teaches. */
export async function planSkillStates(userId: string, plan: ActivePlan): Promise<SkillState[]> {
  const tasks = plan.weeks.flatMap((w) => w.tasks).filter((t) => t.skillId);
  const skillIds = [...new Set(tasks.map((t) => t.skillId!))];
  if (skillIds.length === 0) return [];

  const [inventory, gapItems, scores] = await Promise.all([
    db.userSkill.findMany({ where: { userId, skillId: { in: skillIds } }, select: { skillId: true, level: true } }),
    db.gapItem.findMany({
      where: { analysisId: plan.gapAnalysisId, skillId: { in: skillIds } },
      select: { skillId: true, requiredLevel: true },
    }),
    db.progressEvent.findMany({
      where: { userId, skillId: { in: skillIds }, kind: { in: ["interview_scored", "assessment_scored"] }, value: { not: null } },
      orderBy: { occurredAt: "desc" },
      select: { skillId: true, value: true },
    }),
  ]);
  const level = new Map(inventory.map((s) => [s.skillId, s.level]));
  const required = new Map(gapItems.map((g) => [g.skillId!, g.requiredLevel ?? 2]));
  const latest = new Map<string, number>();
  for (const s of scores) if (!latest.has(s.skillId!)) latest.set(s.skillId!, s.value!);

  return skillIds.map((skillId) => ({
    skillId,
    name: tasks.find((t) => t.skillId === skillId)!.skill?.name ?? "Skill",
    level: level.get(skillId) ?? 0,
    requiredLevel: required.get(skillId) ?? 2,
    hasRemainingTasks: tasks.some((t) => t.skillId === skillId && (t.status === "todo" || t.status === "doing")),
    latestScore: latest.get(skillId) ?? null,
  }));
}

/** Evaluate replan triggers for the user's active plan. */
export async function reviewPlan(userId: string, now = new Date()): Promise<{ plan: ActivePlan | null; triggers: Trigger[] }> {
  const plan = await loadActivePlan(userId);
  if (!plan) return { plan: null, triggers: [] };
  const triggers = evaluateTriggers({ weeks: weekProgress(plan, now), skills: await planSkillStates(userId, plan) });
  return { plan, triggers };
}

function sum(xs: number[]): number {
  return Math.round(xs.reduce((a, b) => a + b, 0) * 10) / 10;
}
