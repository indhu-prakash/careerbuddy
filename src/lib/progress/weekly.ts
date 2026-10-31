import "server-only";
import { db } from "@/lib/db";
import { todayUtc } from "@/lib/plan/build";
import { reviewPlan } from "./review";

/**
 * Weekly job (F6): mark overdue tasks as missed (with progress events, which feed the
 * "behind" trigger), then count active plans that now have replan triggers. Revised plans
 * are not generated here, since that would spend AI requests for every user every week;
 * users see the triggers on their dashboard and propose a revision with one click.
 */
export async function runWeeklyReview(now = new Date()) {
  const today = todayUtc(now);
  const overdue = await db.planTask.findMany({
    where: { status: "todo", dueDate: { lt: today }, week: { plan: { status: "active" } } },
    select: { id: true, userId: true, skillId: true },
    take: 5000,
  });
  if (overdue.length) {
    await db.$transaction([
      db.planTask.updateMany({ where: { id: { in: overdue.map((t) => t.id) } }, data: { status: "missed" } }),
      db.progressEvent.createMany({
        data: overdue.map((t) => ({ userId: t.userId, kind: "task_missed" as const, taskId: t.id, skillId: t.skillId, occurredAt: now })),
      }),
    ]);
  }

  const users = await db.learningPlan.findMany({
    where: { status: "active" },
    select: { userId: true },
    distinct: ["userId"],
  });
  let withTriggers = 0;
  for (const { userId } of users) {
    if ((await reviewPlan(userId, now)).triggers.length) withTriggers += 1;
  }
  return { missedTasks: overdue.length, activePlans: users.length, plansWithTriggers: withTriggers };
}
