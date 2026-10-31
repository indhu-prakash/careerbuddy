// Client-side shapes of the /api/v1/plans and /api/v1/projects responses (dates as ISO
// strings). Server pages pass the same data through toClient() so both paths match.
import type { listPlans, PlanDetail } from "@/lib/plan/service";
import type { listProjects } from "@/lib/projects/service";

type Jsonify<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Jsonify<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T;

export type Plan = Jsonify<PlanDetail>;
export type PlanWeek = Plan["weeks"][number];
export type PlanTask = PlanWeek["tasks"][number];
export type PlanSummary = Jsonify<Awaited<ReturnType<typeof listPlans>>[number]>;
export type ProjectList = Jsonify<Awaited<ReturnType<typeof listProjects>>>;
export type Project = ProjectList["projects"][number];

/** Week content as written by the plan service (PlanWeek.content). */
export type WeekContent = {
  exercises?: string[];
  skills?: { key: string; name: string; tier: string; hours: number }[];
  resources?: { title: string; url: string; kind: string; skill: string }[];
  textSource?: "ai" | "template";
};

export function toClient<T>(value: T): Jsonify<T> {
  return JSON.parse(JSON.stringify(value));
}

export const API_ERRORS: Record<string, string> = {
  unauthorized: "Your session expired. Sign in again.",
  no_analysis: "Run a skill-gap analysis first.",
  not_found: "That wasn't found. Run a skill-gap analysis first.",
  no_gaps: "Your latest analysis has no gaps to close.",
  no_valid_ideas: "The ideas didn't match your gap skills. Try again.",
  ai_daily_limit: "You've reached today's AI limit. Try again tomorrow.",
  ai_busy: "The AI service is busy. Try again in a minute.",
  invalid_body: "Check the values and try again.",
  score_requires_assessment: "Scores can only be recorded on assessment tasks.",
};

/** fetch + JSON with the API's error codes mapped to readable messages. */
export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(API_ERRORS[body.error] ?? "Something went wrong. Try again.");
  return body as T;
}
