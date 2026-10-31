import "server-only";
import { db } from "@/lib/db";
import { AiProviderError } from "@/lib/ai/client";
import { AiBudgetExceededError } from "@/lib/ai/service";
import { createPlan, PlanInputError } from "@/lib/plan/service";
import { ProjectInputError, suggestProjects } from "@/lib/projects/service";

export type BuildStepKey = "plan" | "projects";
export type BuildStep = {
  step: BuildStepKey;
  outcome: "ran" | "skipped" | "failed";
  /** Skipped: already_done | needs_gap_map. Failed: an API error code (ai_daily_limit, ai_busy, no_gaps, ...). */
  reason?: string;
  /** Ran: what was created. */
  detail?: { planId?: string; weeks?: number; projects?: number };
};

/** Map a step failure to an API error code (same codes the plans/projects routes return). */
export function failureCode(error: unknown): string {
  if (error instanceof AiBudgetExceededError) return "ai_daily_limit";
  if (error instanceof AiProviderError && error.kind === "rate_limited") return "ai_busy";
  if (error instanceof PlanInputError || error instanceof ProjectInputError) return error.code;
  return "failed";
}

/**
 * "Build my roadmap": run the automatable steps in order, skipping ones already done.
 * 1. plan: latest gap analysis but no active plan -> createPlan.
 * 2. projects: no (non-dropped) projects for the plan's analysis -> suggestProjects.
 * Each step is independent: a failure is recorded and the next step still runs.
 * Profile, gap analysis, interviews and applications need the user and are never run here.
 */
export async function buildRoadmap(userId: string): Promise<{ steps: BuildStep[] }> {
  const [analysis, activePlan] = await Promise.all([
    db.gapAnalysis.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true } }),
    db.learningPlan.findFirst({
      where: { userId, status: "active" },
      orderBy: { createdAt: "desc" },
      select: { id: true, gapAnalysisId: true },
    }),
  ]);
  const steps: BuildStep[] = [];
  let plan = activePlan;

  // 1. Learning plan
  if (plan) steps.push({ step: "plan", outcome: "skipped", reason: "already_done" });
  else if (!analysis) steps.push({ step: "plan", outcome: "skipped", reason: "needs_gap_map" });
  else {
    try {
      const created = await createPlan(userId, { gapAnalysisId: analysis.id });
      if (created) {
        plan = { id: created.id, gapAnalysisId: created.gapAnalysisId };
        steps.push({ step: "plan", outcome: "ran", detail: { planId: created.id, weeks: created.durationWeeks } });
      } else steps.push({ step: "plan", outcome: "failed", reason: "no_analysis" });
    } catch (error) {
      const reason = failureCode(error);
      if (reason === "failed") console.error("[roadmap] plan step", error);
      steps.push({ step: "plan", outcome: "failed", reason });
    }
  }

  // 2. Portfolio projects, for the plan's analysis (else the latest one)
  const gapAnalysisId = plan?.gapAnalysisId ?? analysis?.id;
  if (!gapAnalysisId) steps.push({ step: "projects", outcome: "skipped", reason: "needs_gap_map" });
  else {
    const existing = await db.portfolioProject.count({
      where: { userId, gapAnalysisId, status: { not: "dropped" } },
    });
    if (existing > 0) steps.push({ step: "projects", outcome: "skipped", reason: "already_done" });
    else {
      try {
        const result = await suggestProjects(userId, plan ? { planId: plan.id } : { gapAnalysisId });
        steps.push(
          result
            ? { step: "projects", outcome: "ran", detail: { projects: result.createdIds.length, planId: result.planId ?? undefined } }
            : { step: "projects", outcome: "failed", reason: "not_found" },
        );
      } catch (error) {
        const reason = failureCode(error);
        if (reason === "failed") console.error("[roadmap] projects step", error);
        steps.push({ step: "projects", outcome: "failed", reason });
      }
    }
  }

  return { steps };
}
