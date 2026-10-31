import "server-only";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { addDays, PLAN_SLACK } from "@/lib/plan/build";
import { placeMilestones } from "@/lib/scoring/schedule";

type Client = PrismaClient | Prisma.TransactionClient;

// PortfolioProject.spec as written by the projects service. Validated on read because
// it is JSONB.
export const ProjectSpecSchema = z.object({
  scope: z.string(),
  architecture: z.string(),
  testing: z.string(),
  deployment: z.string(),
  deliverables: z.array(z.string()),
  milestones: z.array(
    z.object({
      title: z.string(),
      deliverable: z.string(),
      estHours: z.number(),
      /** Plan tasks for this milestone (several when it is split across weeks). */
      taskIds: z.array(z.string()),
      /** Week the milestone is due (its last piece), null when it didn't fit. */
      weekNumber: z.number().nullable(),
    }),
  ),
  /** Gap keys (see plan/build gapKey) the project covers, for the coverage view. */
  skillKeys: z.array(z.string()),
  promptVersion: z.string(),
});

export type ProjectSpec = z.infer<typeof ProjectSpecSchema>;

export function readSpec(spec: unknown): ProjectSpec | null {
  const parsed = ProjectSpecSchema.safeParse(spec);
  return parsed.success ? parsed.data : null;
}

/**
 * Put each project's milestones into the plan as PlanTask(kind = project_milestone),
 * without pushing any week past hoursPerWeek * (1 - slack). Milestones start no earlier
 * than the first week that teaches one of the project's skills; big ones are split over
 * weeks. Updates each project's spec (taskIds, weekNumber) and planId. Returns
 * milestones that didn't fit.
 */
export async function fitMilestones(
  client: Client,
  opts: {
    userId: string;
    planId: string;
    projects: { id: string; title: string; skillIds: string[]; spec: ProjectSpec }[];
  },
): Promise<{ unplaced: { projectId: string; title: string }[] }> {
  const plan = await client.learningPlan.findFirstOrThrow({
    where: { id: opts.planId, userId: opts.userId },
    select: {
      hoursPerWeek: true,
      weeks: {
        orderBy: { weekNumber: "asc" },
        select: {
          id: true,
          weekNumber: true,
          startDate: true,
          tasks: { select: { estHours: true, skillId: true, position: true, kind: true } },
        },
      },
    },
  });
  if (!plan.weeks.length) {
    return {
      unplaced: opts.projects.flatMap((p) => p.spec.milestones.map((m) => ({ projectId: p.id, title: m.title }))),
    };
  }

  const firstWeek = plan.weeks[0].weekNumber;
  const inputs = opts.projects.map((p) => {
    const skills = new Set(p.skillIds);
    const start = plan.weeks.find((w) => w.tasks.some((t) => t.kind !== "project_milestone" && t.skillId && skills.has(t.skillId)));
    return p.spec.milestones.map((m, i) => ({
      key: `${p.id}:${i}`,
      estHours: m.estHours,
      earliestWeek: start?.weekNumber ?? firstWeek,
    }));
  });
  const capacity = Math.floor(plan.hoursPerWeek * (1 - PLAN_SLACK) * 2) / 2;
  const { placed } = placeMilestones(
    plan.weeks.map((w) => ({ weekNumber: w.weekNumber, usedHours: w.tasks.reduce((n, t) => n + t.estHours, 0) })),
    inputs,
    capacity,
  );
  const piecesOf = new Map<string, { weekNumber: number; hours: number }[]>();
  for (const p of placed) piecesOf.set(p.key, [...(piecesOf.get(p.key) ?? []), p]);
  const nextPos = new Map(plan.weeks.map((w) => [w.weekNumber, Math.max(-1, ...w.tasks.map((t) => t.position)) + 1]));

  const unplaced: { projectId: string; title: string }[] = [];
  for (const p of opts.projects) {
    const milestones: ProjectSpec["milestones"] = [];
    for (const [i, m] of p.spec.milestones.entries()) {
      const pieces = piecesOf.get(`${p.id}:${i}`) ?? [];
      if (!pieces.length) {
        unplaced.push({ projectId: p.id, title: m.title });
        milestones.push({ ...m, taskIds: [], weekNumber: null });
        continue;
      }
      const taskIds: string[] = [];
      for (const [j, piece] of pieces.entries()) {
        const week = plan.weeks.find((w) => w.weekNumber === piece.weekNumber)!;
        const position = nextPos.get(week.weekNumber)!;
        nextPos.set(week.weekNumber, position + 1);
        const part = pieces.length > 1 ? ` (part ${j + 1} of ${pieces.length})` : "";
        const task = await client.planTask.create({
          data: {
            weekId: week.id,
            userId: opts.userId,
            kind: "project_milestone",
            position,
            title: `${p.title}: ${m.title}${part}`,
            estHours: piece.hours,
            dueDate: week.startDate ? addDays(week.startDate, 6) : null,
          },
          select: { id: true },
        });
        taskIds.push(task.id);
      }
      milestones.push({ ...m, taskIds, weekNumber: pieces[pieces.length - 1].weekNumber });
    }
    await client.portfolioProject.update({
      where: { id: p.id },
      data: { planId: opts.planId, spec: { ...p.spec, milestones } },
    });
  }
  return { unplaced };
}
