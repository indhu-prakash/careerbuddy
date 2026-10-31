import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { createPlan, refitProjects, TX_OPTIONS } from "@/lib/plan/service";
import { recordProgress } from "@/lib/progress/record";
import { diffTasks, evaluateTriggers, type Trigger } from "@/lib/scoring/replan";
import { currentWeek, loadActivePlan, planSkillStates, weekProgress } from "./review";

export class ReplanError extends Error {
  constructor(readonly code: "not_found" | "not_active" | "no_changes" | "no_gaps") {
    super(code);
  }
}

/**
 * F6: build a revised version of the active plan for its remaining weeks and save it as a
 * draft. Nothing changes for the user until they accept it. Behind/ahead use the pace the
 * user actually kept; mastered skills are dropped, weak ones get reinforcement, and hours
 * already spent count towards each skill.
 */
export async function proposeReplan(userId: string, planId: string, now = new Date()) {
  const plan = await loadActivePlan(userId);
  if (!plan || plan.id !== planId) {
    const exists = await db.learningPlan.findFirst({ where: { id: planId, userId }, select: { id: true } });
    throw new ReplanError(exists ? "not_active" : "not_found");
  }

  const progress = weekProgress(plan, now);
  const triggers = evaluateTriggers({ weeks: progress, skills: await planSkillStates(userId, plan) });
  const has = (kind: Trigger["kind"]) => triggers.find((t) => t.kind === kind);

  const week = Math.max(1, currentWeek(plan, now));
  const remainingWeeks = Math.max(1, plan.durationWeeks - week + 1);

  let hoursPerWeek = plan.hoursPerWeek;
  if (has("behind") || has("ahead")) {
    const recent = progress.filter((w) => w.ended && w.plannedHours > 0).slice(-2);
    const pace = recent.reduce((n, w) => n + w.actualHours / w.plannedHours, 0) / recent.length;
    hoursPerWeek = Math.min(80, Math.max(1, Math.round(plan.hoursPerWeek * pace)));
  }

  const doneHours: Record<string, number> = {};
  for (const t of plan.weeks.flatMap((w) => w.tasks)) {
    if (t.skillId && t.hoursSpent > 0) doneHours[t.skillId] = (doneHours[t.skillId] ?? 0) + t.hoursSpent;
  }
  const dropSkillIds = has("mastered")?.skillIds ?? [];
  const boostSkillIds = has("weak")?.skillIds ?? [];
  const reason = triggers.length ? triggers.map((t) => t.reason).join(" ") : "Rebuilt the remaining weeks on request.";

  let draft;
  try {
    draft = await createPlan(userId, {
      gapAnalysisId: plan.gapAnalysisId,
      weeks: remainingWeeks,
      hoursPerWeek,
      doneHours,
      draftOf: plan.id,
      dropSkillIds,
      boostSkillIds,
      reason,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "no_gaps") throw new ReplanError("no_gaps");
    throw error;
  }
  if (!draft) throw new ReplanError("not_found");

  // Compare on the original plan's calendar: draft week 1 = current week.
  const offset = week - 1;
  const before = plan.weeks.flatMap((w) =>
    w.tasks
      .filter((t) => (t.status === "todo" || t.status === "doing") && w.weekNumber >= week)
      .map((t) => ({ title: t.title, skill: t.skill?.name ?? null, weekNumber: w.weekNumber })),
  );
  const after = draft.weeks.flatMap((w) =>
    w.tasks.map((t) => ({ title: t.title, skill: t.skill?.name ?? null, weekNumber: w.weekNumber + offset })),
  );
  const diff = diffTasks(before, after);
  const dropped = new Set(dropSkillIds);
  const deferred = draft.deferred.filter((d) => !dropped.has(d.skillId)).map((d) => d.name);

  if (!diff.added.length && !diff.removed.length && !diff.moved.length && hoursPerWeek === plan.hoursPerWeek) {
    await db.learningPlan.delete({ where: { id: draft.id } });
    throw new ReplanError("no_changes");
  }

  const changeSummary = {
    ...((draft.changeSummary as Record<string, unknown> | null) ?? {}),
    explanation: explain({ triggers, diff, hoursPerWeek, previousHours: plan.hoursPerWeek, remainingWeeks, deferred }),
    triggers: triggers.map(({ kind, reason }) => ({ kind, reason })),
    added: diff.added,
    removed: diff.removed,
    moved: diff.moved,
    deferred,
  } satisfies Prisma.InputJsonValue;
  await db.learningPlan.update({ where: { id: draft.id }, data: { changeSummary } });

  return { draftId: draft.id, version: draft.version, changeSummary };
}

// Plain-language summary built from the computed changes (no extra AI request).
function explain(x: {
  triggers: Trigger[];
  diff: ReturnType<typeof diffTasks>;
  hoursPerWeek: number;
  previousHours: number;
  remainingWeeks: number;
  deferred: string[];
}): string {
  const parts = x.triggers.map((t) => t.reason);
  if (x.hoursPerWeek !== x.previousHours) {
    parts.push(`The remaining ${x.remainingWeeks} week(s) are planned at ${x.hoursPerWeek} h/week instead of ${x.previousHours}.`);
  }
  parts.push(
    `${x.diff.added.length} task(s) added, ${x.diff.removed.length} removed and ${x.diff.moved.length} moved.`,
  );
  if (x.deferred.length) parts.push(`Not enough time left for: ${x.deferred.join(", ")}.`);
  return parts.join(" ");
}

/** Activate a proposed revision: the old plan is superseded and projects move over. */
export async function acceptReplan(userId: string, draftId: string) {
  const draft = await db.learningPlan.findFirst({
    where: { id: draftId, userId, status: "draft" },
    select: { id: true, parentId: true, gapAnalysisId: true, reason: true },
  });
  if (!draft) throw new ReplanError("not_found");

  await db.$transaction(async (tx) => {
    await tx.learningPlan.updateMany({ where: { userId, status: "active" }, data: { status: "superseded" } });
    await tx.learningPlan.update({ where: { id: draft.id }, data: { status: "active" } });
    await refitProjects(tx, userId, draft.gapAnalysisId, draft.id);
    await recordProgress({ userId, kind: "plan_revised", refId: draft.id, note: draft.reason?.slice(0, 500) ?? null }, tx);
  }, TX_OPTIONS);
  return { planId: draft.id };
}

/** Throw away a proposed revision; the current plan stays as it is. */
export async function discardReplan(userId: string, draftId: string) {
  const { count } = await db.learningPlan.deleteMany({ where: { id: draftId, userId, status: "draft" } });
  if (!count) throw new ReplanError("not_found");
}
