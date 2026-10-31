// Dashboard metrics (F6). Pure functions over saved rows.

/**
 * Readiness 0..1: the latest gap map's demand-weighted match, recomputed with the user's
 * *current* skill levels, so it moves as tasks, self-ratings and interviews raise levels.
 */
export function readiness(
  items: { skillId: string | null; demand: number; requiredLevel: number | null; currentLevel: number | null }[],
  levels: Map<string, number>,
): number {
  let num = 0;
  let den = 0;
  for (const i of items) {
    const required = i.requiredLevel ?? 2;
    const level = (i.skillId ? levels.get(i.skillId) : undefined) ?? i.currentLevel ?? 0;
    const have = level >= required ? 1 : level > 0 ? 0.5 : 0;
    num += i.demand * have;
    den += i.demand;
  }
  return den ? Math.round((num / den) * 1000) / 1000 : 0;
}

/** Consecutive days with activity, ending today or yesterday (today may not be logged yet). */
export function activityStreak(dates: Date[], now = new Date()): number {
  const days = new Set(dates.map(dayKey));
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!days.has(dayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/** Hours logged per ISO week (Monday start, UTC) for the last `weeks` weeks, oldest first. */
export function hoursByWeek(
  events: { hours: number | null; occurredAt: Date }[],
  weeks = 8,
  now = new Date(),
): { weekStart: string; hours: number }[] {
  const start = mondayOf(now);
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - 7 * (weeks - 1 - i));
    return { weekStart: dayKey(d), hours: 0 };
  });
  const index = new Map(buckets.map((b, i) => [b.weekStart, i]));
  for (const e of events) {
    const i = index.get(dayKey(mondayOf(e.occurredAt)));
    if (i !== undefined && e.hours) buckets[i].hours = Math.round((buckets[i].hours + e.hours) * 10) / 10;
  }
  return buckets;
}

function mondayOf(d: Date): Date {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
