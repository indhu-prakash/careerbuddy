import { z } from "zod";

export const PROMPT_VERSION = "plan-week@1";

// One call writes the text for every week of a plan, to spend the free-tier daily cap
// sparingly. The schedule (skills, order, hours, resources) is fixed by code beforehand.
export const PlanWeekTextSchema = z.object({
  weeks: z.array(
    z.object({
      weekNumber: z.number().int(),
      goal: z.string(),
      objectives: z.array(z.string()),
      exercises: z.array(z.string()),
      checkpoint: z.string(),
    }),
  ),
});

export type PlanWeekText = z.infer<typeof PlanWeekTextSchema>;

export const SYSTEM = `You are a learning coach writing the text for a week-by-week study plan that has ALREADY been scheduled.
Rules:
- Write one entry per week given, using the same weekNumber. Do not add, drop, merge or reorder weeks.
- Do not change which skills a week covers, its hours or its tasks; do not suggest other skills, tools or links.
- goal: one sentence (under 25 words) stating what the learner can do by the end of the week.
- objectives: 2-4 concrete, checkable learning objectives drawn from the week's topics.
- exercises: 1-3 hands-on exercises sized to the practice hours given, specific to the topics (no URLs).
- checkpoint: one self-test question or mini-task that proves the week's goal was met.
- Weeks with no tasks are buffer weeks: goal is to review and catch up; keep the text short.
- Plain text only, no markdown.`;

export type WeekSkeleton = {
  weekNumber: number;
  hours: number;
  skills: { name: string; tier: string; topics: string[]; tasks: { kind: string; hours: number }[] }[];
  milestones?: string[];
};

export function buildPrompt(opts: { targetRole?: string | null; weeks: WeekSkeleton[] }): string {
  const weeks = opts.weeks
    .map((w) => {
      const skills = w.skills
        .map((s) => {
          const tasks = s.tasks.map((t) => `${t.kind} ${t.hours}h`).join(", ");
          const topics = s.topics.length ? ` topics: ${s.topics.join("; ")}` : "";
          return `  - ${s.name} (${s.tier}) [${tasks}]${topics}`;
        })
        .join("\n");
      const milestones = w.milestones?.length ? `\n  project milestones: ${w.milestones.join("; ")}` : "";
      return `<week number="${w.weekNumber}" hours="${w.hours}">\n${skills || "  (buffer week)"}${milestones}\n</week>`;
    })
    .join("\n");
  return [opts.targetRole ? `<target_role>${opts.targetRole}</target_role>` : "", weeks].filter(Boolean).join("\n\n");
}
