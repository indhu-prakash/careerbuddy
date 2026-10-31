import "server-only";
import { db } from "@/lib/db";
import type { ProjectStatus } from "@/generated/prisma/client";
import { loadGapContext } from "@/lib/analysis/load";
import { runAiTask } from "@/lib/ai/service";
import { buildPrompt, ProjectIdeasSchema, PROMPT_VERSION, SYSTEM, type ProjectIdea } from "@/lib/ai/prompts/project-ideas";
import { gapsFromContext, milestoneHours } from "@/lib/plan/build";
import { TX_OPTIONS } from "@/lib/plan/service";
import { selectProjects } from "@/lib/scoring/coverage";
import { rankGaps, rankScore, type ScheduleGap } from "@/lib/scoring/schedule";
import { buildSkillIndex, lookupSkill } from "@/lib/skills/resolve";
import { normalizeSkillTerm } from "@/lib/skills/normalize";
import { fitMilestones, readSpec, type ProjectSpec } from "./milestones";

export class ProjectInputError extends Error {
  constructor(readonly code: "no_gaps" | "no_valid_ideas") {
    super(code);
  }
}

const TOP_N = 5;

/** Gap skills the AI's tags resolve to: catalog id first, else exact gap name (non-catalog gaps). */
export function resolveTags(
  tags: string[],
  index: ReturnType<typeof buildSkillIndex>,
  gaps: ScheduleGap[],
): { keys: string[]; names: string[] } {
  const byName = new Map(gaps.map((g) => [normalizeSkillTerm(g.name), g]));
  const keys: string[] = [];
  const names: string[] = [];
  for (const tag of tags) {
    const skill = lookupSkill(index, tag);
    const key = skill?.id ?? byName.get(normalizeSkillTerm(tag))?.skillId;
    if (!key || keys.includes(key)) continue; // unknown tag: dropped
    keys.push(key);
    names.push(skill?.name ?? byName.get(normalizeSkillTerm(tag))!.name);
  }
  return { keys, names };
}

export function formatTalkingPoints(t: ProjectIdea["talkingPoints"]): string {
  return [
    `Situation: ${t.situation}`,
    `Task: ${t.task}`,
    `Action: ${t.action}`,
    `Result: ${t.result}`,
  ].join("\n");
}

/**
 * Suggest 2-4 portfolio projects for a gap analysis: one AI call proposes candidates,
 * tags are validated against the catalog, code selects by weighted set cover, and
 * milestones are fitted into the plan (the given one, else the analysis's active plan).
 * Replaces earlier still-"suggested" projects for the same analysis.
 * Returns null if the analysis or plan isn't the user's.
 */
export async function suggestProjects(userId: string, input: { gapAnalysisId?: string; planId?: string }) {
  let plan: { id: string; gapAnalysisId: string; durationWeeks: number; hoursPerWeek: number } | null = null;
  if (input.planId) {
    plan = await db.learningPlan.findFirst({
      where: { id: input.planId, userId },
      select: { id: true, gapAnalysisId: true, durationWeeks: true, hoursPerWeek: true },
    });
    if (!plan) return null;
  }
  const ctx = await loadGapContext(userId, input.gapAnalysisId ?? plan?.gapAnalysisId);
  if (!ctx) return null;
  if (plan && plan.gapAnalysisId !== ctx.id) return null;
  plan ??= await db.learningPlan.findFirst({
    where: { userId, gapAnalysisId: ctx.id, status: "active" },
    orderBy: { createdAt: "desc" },
    select: { id: true, gapAnalysisId: true, durationWeeks: true, hoursPerWeek: true },
  });

  const ranked = rankGaps(gapsFromContext(ctx.items));
  if (!ranked.length) throw new ProjectInputError("no_gaps");
  const top = ranked.slice(0, TOP_N);
  const strengths = ctx.items.filter((i) => i.status === "matched").map((i) => i.skill?.name ?? i.skillName);

  const { data } = await runAiTask({
    task: "projects.ideas",
    promptVersion: PROMPT_VERSION,
    userId,
    system: SYSTEM,
    prompt: buildPrompt({
      targetRole: ctx.targetRole?.title,
      topGaps: top.map((g) => g.name),
      otherGaps: ranked.slice(TOP_N, TOP_N + 10).map((g) => g.name),
      strengths: strengths.slice(0, 8),
      hoursPerWeek: plan?.hoursPerWeek ?? ctx.budget.hoursPerWeek,
      weeks: plan?.durationWeeks ?? ctx.budget.weeks,
    }),
    schema: ProjectIdeasSchema,
    effort: "low",
    maxTokens: 12000,
  });

  const catalog = await db.skill.findMany({ select: { id: true, slug: true, name: true, aliases: true } });
  const index = buildSkillIndex(catalog);
  const candidates = data.projects.slice(0, 10).map((idea, i) => ({ key: String(i), idea, ...resolveTags(idea.skills, index, ranked) }));
  const weights = new Map(ranked.map((g) => [g.skillId, Math.max(rankScore(g), 1e-6)]));
  const selection = selectProjects(
    candidates.map((c) => ({ key: c.key, skills: c.keys })),
    weights,
    { min: 2, max: 4, top: top.map((g) => g.skillId) },
  );
  if (!selection.chosen.length) throw new ProjectInputError("no_valid_ideas");

  const result = await db.$transaction(async (tx) => {
    // Re-suggesting replaces untouched suggestions and their open milestone tasks.
    const old = await tx.portfolioProject.findMany({
      where: { userId, gapAnalysisId: ctx.id, status: "suggested" },
      select: { id: true, spec: true },
    });
    const oldTaskIds = old.flatMap((p) => readSpec(p.spec)?.milestones.flatMap((m) => m.taskIds) ?? []);
    if (oldTaskIds.length) await tx.planTask.deleteMany({ where: { id: { in: oldTaskIds }, userId, status: "todo" } });
    if (old.length) await tx.portfolioProject.deleteMany({ where: { id: { in: old.map((p) => p.id) }, userId } });

    const created = [];
    for (const key of selection.chosen) {
      const c = candidates.find((x) => x.key === key)!;
      const milestones = c.idea.milestones.slice(0, 4);
      const spec: ProjectSpec = {
        scope: c.idea.scope,
        architecture: c.idea.architecture,
        testing: c.idea.testing,
        deployment: c.idea.deployment,
        deliverables: c.idea.deliverables,
        milestones: milestones.map((m) => ({
          title: m.title,
          deliverable: m.deliverable,
          estHours: milestoneHours(c.idea.tier, milestones.length),
          taskIds: [],
          weekNumber: null,
        })),
        skillKeys: c.keys.filter((k) => weights.has(k)),
        promptVersion: PROMPT_VERSION,
      };
      const row = await tx.portfolioProject.create({
        data: {
          userId,
          gapAnalysisId: ctx.id,
          planId: plan?.id ?? null,
          tier: c.idea.tier,
          title: c.idea.title,
          description: c.idea.problem,
          spec,
          skills: c.names,
          talkingPoints: formatTalkingPoints(c.idea.talkingPoints),
        },
        select: { id: true, title: true },
      });
      created.push({ ...row, spec, skillIds: spec.skillKeys.filter((k) => !k.startsWith("name:")) });
    }
    const fit = plan ? await fitMilestones(tx, { userId, planId: plan.id, projects: created }) : { unplaced: [] };
    return { ids: created.map((p) => p.id), unplaced: fit.unplaced };
  }, TX_OPTIONS);

  const listed = await listProjects(userId, { gapAnalysisId: ctx.id });
  return { ...listed, planId: plan?.id ?? null, unplacedMilestones: result.unplaced, createdIds: result.ids };
}

const PROJECT_SELECT = {
  id: true,
  gapAnalysisId: true,
  planId: true,
  tier: true,
  title: true,
  description: true,
  spec: true,
  skills: true,
  talkingPoints: true,
  status: true,
  repoUrl: true,
  createdAt: true,
} as const;

/**
 * The user's projects for one gap analysis (default: the latest one), with a coverage
 * view: for each top-5 gap, which non-dropped projects cover it.
 */
export async function listProjects(userId: string, opts: { gapAnalysisId?: string } = {}) {
  const ctx = await loadGapContext(userId, opts.gapAnalysisId);
  const rows = ctx
    ? await db.portfolioProject.findMany({
        where: { userId, gapAnalysisId: ctx.id },
        orderBy: { createdAt: "asc" },
        select: PROJECT_SELECT,
      })
    : [];
  const projects = rows.map((p) => ({ ...p, spec: readSpec(p.spec), skills: Array.isArray(p.skills) ? (p.skills as string[]) : [] }));
  const top = ctx ? rankGaps(gapsFromContext(ctx.items)).slice(0, TOP_N) : [];
  const coverage = top.map((g) => ({
    skillKey: g.skillId,
    name: g.name,
    projectIds: projects.filter((p) => p.status !== "dropped" && p.spec?.skillKeys.includes(g.skillId)).map((p) => p.id),
  }));
  return { gapAnalysisId: ctx?.id ?? null, projects, coverage };
}

/**
 * Update status / repo URL. Dropping a project skips its open milestone tasks so the
 * plan stops counting them. Returns null if the project isn't the user's.
 */
export async function updateProject(
  userId: string,
  id: string,
  patch: { status?: ProjectStatus; repoUrl?: string | null },
) {
  const project = await db.portfolioProject.findFirst({ where: { id, userId }, select: { id: true, spec: true } });
  if (!project) return null;
  return db.$transaction(async (tx) => {
    if (patch.status === "dropped") {
      const taskIds = readSpec(project.spec)?.milestones.flatMap((m) => m.taskIds) ?? [];
      if (taskIds.length) {
        await tx.planTask.updateMany({
          where: { id: { in: taskIds }, userId, status: { in: ["todo", "doing"] } },
          data: { status: "skipped" },
        });
      }
    }
    const row = await tx.portfolioProject.update({
      where: { id: project.id },
      data: { status: patch.status, repoUrl: patch.repoUrl },
      select: PROJECT_SELECT,
    });
    return { ...row, spec: readSpec(row.spec) };
  }, TX_OPTIONS);
}
