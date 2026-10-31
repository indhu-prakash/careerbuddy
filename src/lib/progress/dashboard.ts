import "server-only";
import { db } from "@/lib/db";
import { activityStreak, hoursByWeek, readiness } from "@/lib/scoring/dashboard";
import { currentWeek, reviewPlan, weekProgress } from "./review";

const DAY = 86_400_000;

/** Everything the signed-in dashboard shows, from saved rows only (no AI calls). */
export async function getDashboard(userId: string, now = new Date()) {
  const since = new Date(now.getTime() - 120 * DAY);
  const [user, analysis, inventory, events, interviews, applications, pendingPlan, { plan, triggers }] =
    await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, onboardedAt: true, hoursPerWeek: true } }),
      db.gapAnalysis.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          matchScore: true,
          createdAt: true,
          targetRole: { select: { title: true } },
          items: {
            orderBy: { position: "asc" },
            select: { skillId: true, skillName: true, demand: true, requiredLevel: true, currentLevel: true, status: true },
          },
        },
      }),
      db.userSkill.findMany({ where: { userId }, select: { skillId: true, level: true } }),
      db.progressEvent.findMany({
        where: { userId, occurredAt: { gte: since } },
        select: { kind: true, hours: true, occurredAt: true },
      }),
      db.interviewSession.findMany({
        where: { userId, status: "completed" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, overallScore: true, createdAt: true, kind: true },
      }),
      db.application.groupBy({ by: ["status"], where: { userId }, _count: true }),
      db.learningPlan.findFirst({
        where: { userId, status: "draft", parentId: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { id: true, reason: true, createdAt: true },
      }),
      reviewPlan(userId, now),
    ]);

  const levels = new Map(inventory.map((s) => [s.skillId, s.level]));

  let planSummary = null;
  if (plan) {
    const tasks = plan.weeks.flatMap((w) => w.tasks);
    const week = currentWeek(plan, now);
    const progress = weekProgress(plan, now);
    planSummary = {
      id: plan.id,
      version: plan.version,
      currentWeek: week,
      durationWeeks: plan.durationWeeks,
      tasksDone: tasks.filter((t) => t.status === "done").length,
      tasksTotal: tasks.filter((t) => t.status !== "skipped").length,
      hoursPlanned: Math.round(progress.reduce((n, w) => n + w.plannedHours, 0) * 10) / 10,
      hoursSpent: Math.round(progress.reduce((n, w) => n + w.actualHours, 0) * 10) / 10,
      weeks: progress,
      nextTasks: plan.weeks
        .filter((w) => w.weekNumber >= Math.max(1, week))
        .flatMap((w) => w.tasks.map((t) => ({ ...t, weekNumber: w.weekNumber, skill: t.skill?.name ?? null })))
        .filter((t) => t.status === "todo" || t.status === "doing")
        .slice(0, 5),
    };
  }

  return {
    name: user.name,
    onboarded: !!user.onboardedAt,
    readiness: analysis ? readiness(analysis.items, levels) : null,
    analysis: analysis
      ? {
          id: analysis.id,
          matchScoreAtAnalysis: analysis.matchScore,
          createdAt: analysis.createdAt,
          targetRole: analysis.targetRole?.title ?? null,
          skills: analysis.items.slice(0, 10).map((i) => ({
            name: i.skillName,
            level: (i.skillId ? levels.get(i.skillId) : undefined) ?? i.currentLevel ?? 0,
            requiredLevel: i.requiredLevel ?? 2,
          })),
        }
      : null,
    plan: planSummary,
    triggers,
    pendingReplan: pendingPlan,
    streakDays: activityStreak(events.map((e) => e.occurredAt), now),
    hoursByWeek: hoursByWeek(events, 8, now),
    interviews: interviews.map((s) => ({ ...s, overallScore: s.overallScore })),
    applications: Object.fromEntries(applications.map((a) => [a.status, a._count])) as Record<string, number>,
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
