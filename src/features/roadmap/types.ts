// Client-side shape of GET /api/v1/roadmap (dates as ISO strings).
import type { Roadmap } from "@/lib/roadmap/service";
import type { BuildStep } from "@/lib/roadmap/build";
import type { toClient } from "@/features/plan/types";

export type RoadmapData = ReturnType<typeof toClient<Roadmap>>;
export type JourneyStage = RoadmapData["stages"][number];
export type TimelineWeek = NonNullable<RoadmapData["plan"]>["weeks"][number];
export type { BuildStep };

export const STATUS_LABEL: Record<JourneyStage["status"], string> = {
  done: "Done",
  in_progress: "In progress",
  next: "Ready to start",
  locked: "Locked",
};

const STEP_NAME: Record<BuildStep["step"], string> = { plan: "Learning plan", projects: "Portfolio projects" };

const REASONS: Record<string, string> = {
  already_done: "already in place, left as is.",
  needs_gap_map: "needs a gap map first. Analyze job descriptions, then try again.",
  no_analysis: "your gap map wasn't found. Run a new analysis.",
  not_found: "your gap map wasn't found. Run a new analysis.",
  no_gaps: "your latest gap map has no gaps to close.",
  no_valid_ideas: "the suggested ideas didn't match your gap skills. Try again.",
  ai_daily_limit: "you've reached today's AI limit. Try again tomorrow.",
  ai_busy: "the AI service is busy. Try again in a minute.",
  failed: "something went wrong. Try again.",
};

/** One readable line per build step. */
export function describeStep(s: BuildStep): string {
  const name = STEP_NAME[s.step];
  if (s.outcome === "ran") {
    if (s.step === "plan") return `${name}: created${s.detail?.weeks ? ` (${s.detail.weeks} weeks)` : ""}.`;
    return `${name}: ${s.detail?.projects ?? 0} suggested and fitted into your plan.`;
  }
  return `${name}: ${REASONS[s.reason ?? "failed"] ?? REASONS.failed}`;
}
