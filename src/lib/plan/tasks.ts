import "server-only";
import { TX_OPTIONS } from "./service";
import { db } from "@/lib/db";
import type { TaskStatus } from "@/generated/prisma/client";
import { recordProgress } from "@/lib/progress/record";

export class TaskUpdateError extends Error {
  constructor(readonly code: "score_requires_assessment") {
    super(code);
  }
}

export type TaskUpdate = { status?: TaskStatus; hoursSpent?: number; score?: number | null };

/**
 * Update one of the user's plan tasks and append the matching progress events (F6):
 * task_completed (+ project_milestone for milestones) when it becomes done, task_missed,
 * hours_logged for the change in hours, and assessment_scored for a new score.
 * Ticking a task done without logging hours counts its estimate as the time spent.
 * Returns null when the task isn't the user's.
 */
export async function updateTask(userId: string, taskId: string, patch: TaskUpdate) {
  return db.$transaction(async (tx) => {
    const task = await tx.planTask.findFirst({
      where: { id: taskId, userId },
      select: { id: true, kind: true, status: true, hoursSpent: true, estHours: true, score: true, skillId: true, completedAt: true },
    });
    if (!task) return null;
    if (patch.score != null && task.kind !== "assessment") throw new TaskUpdateError("score_requires_assessment");

    const status = patch.status ?? task.status;
    const becameDone = status === "done" && task.status !== "done";
    let hoursSpent = patch.hoursSpent ?? task.hoursSpent;
    if (becameDone && patch.hoursSpent === undefined && hoursSpent === 0) hoursSpent = task.estHours;

    const updated = await tx.planTask.update({
      where: { id: task.id },
      data: {
        status,
        hoursSpent,
        score: patch.score === undefined ? undefined : patch.score,
        completedAt: status === "done" ? (task.completedAt ?? new Date()) : null,
      },
      select: {
        id: true,
        kind: true,
        title: true,
        status: true,
        estHours: true,
        hoursSpent: true,
        score: true,
        completedAt: true,
      },
    });

    const base = { userId, taskId: task.id, skillId: task.skillId };
    const delta = Math.round((hoursSpent - task.hoursSpent) * 100) / 100;
    if (delta !== 0) {
      await recordProgress({ ...base, kind: "hours_logged", hours: delta, note: delta < 0 ? "correction" : null }, tx);
    }
    if (becameDone) {
      await recordProgress({ ...base, kind: "task_completed", hours: hoursSpent }, tx);
      if (task.kind === "project_milestone") await recordProgress({ ...base, kind: "project_milestone" }, tx);
    }
    if (status === "missed" && task.status !== "missed") await recordProgress({ ...base, kind: "task_missed" }, tx);
    if (patch.score != null && patch.score !== task.score) {
      await recordProgress({ ...base, kind: "assessment_scored", value: patch.score }, tx);
    }
    return updated;
  }, TX_OPTIONS);
}
