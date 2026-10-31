import "server-only";
import { db } from "@/lib/db";
import { GHOSTABLE_STAGES, ghostDays, shouldGhost } from "@/lib/scoring/applications";

const DAY_MS = 86_400_000;
const BATCH = 200;

/**
 * Mark applications still waiting on the company with no activity for N days
 * (APPLICATION_GHOST_DAYS, default 21) as ghosted, recording an event for each.
 */
export async function ghostStaleApplications(now = new Date()): Promise<{ ghosted: number; days: number }> {
  const days = ghostDays();
  const cutoff = new Date(now.getTime() - days * DAY_MS);
  let ghosted = 0;
  let cursor: string | undefined;

  for (;;) {
    // Cheap prefilter on appliedAt; the last-event check happens in shouldGhost.
    const candidates = await db.application.findMany({
      where: {
        status: { in: GHOSTABLE_STAGES },
        appliedAt: { lte: cutoff },
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: BATCH,
      select: {
        id: true,
        userId: true,
        status: true,
        appliedAt: true,
        events: { orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
      },
    });
    if (candidates.length === 0) break;
    cursor = candidates[candidates.length - 1].id;

    const stale = candidates.filter((a) =>
      shouldGhost({ status: a.status, appliedAt: a.appliedAt, lastEventAt: a.events[0]?.occurredAt }, now, days),
    );
    if (stale.length > 0) {
      await db.$transaction(
        stale.flatMap((a) => [
          db.applicationEvent.create({
            data: {
              applicationId: a.id,
              userId: a.userId,
              stage: "ghosted",
              occurredAt: now,
              notes: `No activity for ${days} days; marked as ghosted automatically.`,
            },
          }),
          db.application.update({ where: { id: a.id }, data: { status: "ghosted" } }),
        ]),
      );
      ghosted += stale.length;
    }
    if (candidates.length < BATCH) break;
  }
  return { ghosted, days };
}
