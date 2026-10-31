import "server-only";
import { db } from "@/lib/db";
import { getPrimaryResume } from "@/lib/intake/resume";
import { listInventory } from "@/lib/intake/skills";
import { getActiveTargetRole } from "@/lib/intake/target-role";
import { getActivePlan } from "@/lib/plan/service";
import { getDashboard } from "@/lib/progress/dashboard";
import { currentWeek } from "@/lib/progress/review";
import { listProjects } from "@/lib/projects/service";
import { buildTimeline, computeStages, nextBestAction, type RoadmapFacts } from "@/lib/scoring/roadmap";

export { buildRoadmap } from "./build";

const RESPONDED = ["screening", "interviewing", "offer", "rejected"];

/** Everything the Roadmap page shows: journey stages, next best action and the plan timeline. Saved rows only, no AI. */
export async function getRoadmap(userId: string, now = new Date()) {
  const [dashboard, resume, role, inventory, user, plan, projects, interviews] = await Promise.all([
    getDashboard(userId, now),
    getPrimaryResume(userId),
    getActiveTargetRole(userId),
    listInventory(userId),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { hoursPerWeek: true } }),
    getActivePlan(userId),
    listProjects(userId),
    db.interviewSession.aggregate({
      where: { userId, status: "completed" },
      _count: true,
      _avg: { overallScore: true },
    }),
  ]);

  const live = projects.projects.filter((p) => p.status !== "dropped");
  const apps = dashboard.applications;
  const facts: RoadmapFacts = {
    profile: {
      hasResume: !!resume,
      skills: inventory.length,
      reviewedSkills: inventory.filter((s) => s.confirmedByUser).length,
      targetRole: role?.title ?? null,
      hoursPerWeek: role?.hoursPerWeek ?? (dashboard.onboarded ? user.hoursPerWeek : null),
      onboarded: dashboard.onboarded,
    },
    analysis: dashboard.analysis
      ? {
          id: dashboard.analysis.id,
          matchScore: dashboard.analysis.matchScoreAtAnalysis,
          targetRole: dashboard.analysis.targetRole,
        }
      : null,
    plan: dashboard.plan
      ? {
          id: dashboard.plan.id,
          currentWeek: dashboard.plan.currentWeek,
          durationWeeks: dashboard.plan.durationWeeks,
          tasksDone: dashboard.plan.tasksDone,
          tasksTotal: dashboard.plan.tasksTotal,
        }
      : null,
    projects: {
      suggested: live.filter((p) => p.status === "suggested").length,
      inProgress: live.filter((p) => p.status === "in_progress").length,
      done: live.filter((p) => p.status === "done").length,
    },
    interviews: { completed: interviews._count, avgScore: interviews._avg.overallScore ?? null },
    applications: {
      total: Object.values(apps).reduce((a, b) => a + b, 0),
      responses: RESPONDED.reduce((n, s) => n + (apps[s] ?? 0), 0),
      offers: apps.offer ?? 0,
    },
    readiness: dashboard.readiness,
  };

  const stages = computeStages(facts);
  const nextKey = nextBestAction(stages, facts);
  const next = nextKey ? stages.find((s) => s.key === nextKey)! : null;
  const week = plan ? currentWeek(plan, now) : 0;

  return {
    targetRole: role?.title ?? dashboard.analysis?.targetRole ?? null,
    readiness: facts.readiness,
    stages,
    nextAction: next ? { stage: next.key, title: next.title, action: next.action, href: next.href, automatable: next.automatable } : null,
    /** Steps "Build my roadmap" would run now. */
    automatable: stages.filter((s) => s.automatable).map((s) => s.key),
    plan: plan
      ? {
          id: plan.id,
          version: plan.version,
          startDate: plan.startDate,
          durationWeeks: plan.durationWeeks,
          hoursPerWeek: plan.hoursPerWeek,
          currentWeek: week,
          totals: plan.totals,
          weeks: buildTimeline(plan.weeks, week),
          deferred: plan.deferred,
          projects: plan.projects,
        }
      : null,
  };
}

export type Roadmap = Awaited<ReturnType<typeof getRoadmap>>;
