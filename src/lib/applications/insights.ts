import "server-only";
import { db } from "@/lib/db";
import { runAiTask } from "@/lib/ai/service";
import {
  AdviceSchema,
  buildPrompt,
  PROMPT_VERSION,
  SYSTEM,
  type ApplicationAdvice,
} from "@/lib/ai/prompts/application-insights";
import {
  computeApplicationStats,
  ghostDays,
  MIN_SAMPLE,
  type ApplicationStats,
} from "@/lib/scoring/applications";

export type ApplicationInsights = {
  stats: ApplicationStats;
  advice: ApplicationAdvice | null;
  adviceStatus: "ok" | "not_requested" | "not_enough_data";
  model: string | null;
};

export async function loadApplicationStats(userId: string, now = new Date()): Promise<ApplicationStats> {
  const apps = await db.application.findMany({
    where: { userId },
    select: {
      status: true,
      appliedAt: true,
      respondedAt: true,
      roleFamily: true,
      seniority: true,
      source: true,
      industry: true,
      companySize: true,
      tailored: true,
      matchScore: true,
    },
  });
  return computeApplicationStats(apps, now, ghostDays());
}

/** Advice needs enough decided applications and at least one segment worth comparing. */
export function hasEnoughForAdvice(stats: ApplicationStats): boolean {
  return (
    stats.overall.decided >= MIN_SAMPLE && Object.values(stats.segments).some((rows) => rows.some((s) => s.sufficient))
  );
}

/**
 * Stats, plus LLM advice when asked for. The model only sees the computed numbers;
 * with too little data it is not called at all. Identical stats are served from cache.
 */
export async function getApplicationInsights(userId: string, opts: { advice: boolean }): Promise<ApplicationInsights> {
  const stats = await loadApplicationStats(userId);
  if (!opts.advice) return { stats, advice: null, adviceStatus: "not_requested", model: null };
  if (!hasEnoughForAdvice(stats)) return { stats, advice: null, adviceStatus: "not_enough_data", model: null };

  const result = await runAiTask({
    task: "applications.advice",
    promptVersion: PROMPT_VERSION,
    userId,
    system: SYSTEM,
    prompt: buildPrompt(stats),
    schema: AdviceSchema,
    effort: "low",
    maxTokens: 800,
  });
  return { stats, advice: result.data, adviceStatus: "ok", model: result.model };
}
