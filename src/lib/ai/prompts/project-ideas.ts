import { z } from "zod";

export const PROMPT_VERSION = "project-ideas@2";

export const PROJECT_TIERS = ["beginner", "intermediate", "advanced", "production"] as const;

// One call proposes all candidates; code validates skill tags against the catalog,
// selects 2-4 by weighted set cover (scoring/coverage.ts) and fits milestones to the plan.
export const ProjectIdeasSchema = z.object({
  projects: z.array(
    z.object({
      title: z.string(),
      tier: z.enum(PROJECT_TIERS),
      problem: z.string(),
      skills: z.array(z.string()),
      scope: z.string(),
      milestones: z.array(z.object({ title: z.string(), deliverable: z.string() })),
      architecture: z.string(),
      testing: z.string(),
      deployment: z.string(),
      deliverables: z.array(z.string()),
      talkingPoints: z.object({
        situation: z.string(),
        task: z.string(),
        action: z.string(),
        result: z.string(),
      }),
    }),
  ),
});

export type ProjectIdeas = z.infer<typeof ProjectIdeasSchema>;
export type ProjectIdea = ProjectIdeas["projects"][number];

export const SYSTEM = `You are a senior engineer suggesting portfolio projects for a career changer.
Rules:
- Propose 5-6 distinct project ideas. Each must demonstrate at least 2 of the gap skills listed, and together they should cover the top gaps.
- skills: tag each project ONLY with skill names copied exactly from <allowed_skills>. No other tags.
- tier: beginner | intermediate | advanced | production, matching the scope.
- Keep each project buildable by one person in roughly 4-20 hours alongside study; scope it tightly.
- milestones: 2-4 ordered steps, each with a concrete deliverable.
- architecture: 2-3 sentences naming components and data flow. testing and deployment: one or two sentences each.
- deliverables: 2-4 items (e.g. repo with README, deployed demo, short write-up).
- talkingPoints: a STAR-style interview story (situation, task, action, result) the learner can tell after building it; the result should name a measurable outcome to aim for.
- Realistic, specific problems (not "todo app"); no URLs; plain text, no markdown.`;

export function buildPrompt(opts: {
  targetRole?: string | null;
  topGaps: string[];
  otherGaps: string[];
  strengths: string[];
  hoursPerWeek: number;
  weeks: number;
}): string {
  const allowed = [...new Set([...opts.topGaps, ...opts.otherGaps, ...opts.strengths])];
  return [
    opts.targetRole ? `<target_role>${opts.targetRole}</target_role>` : "",
    `<time_budget>${opts.hoursPerWeek} hours/week for ${opts.weeks} weeks, shared with study</time_budget>`,
    `<top_gaps>\n${opts.topGaps.join("\n")}\n</top_gaps>`,
    opts.otherGaps.length ? `<other_gaps>\n${opts.otherGaps.join("\n")}\n</other_gaps>` : "",
    opts.strengths.length ? `<existing_strengths>\n${opts.strengths.join("\n")}\n</existing_strengths>` : "",
    `<allowed_skills>\n${allowed.join("\n")}\n</allowed_skills>`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
