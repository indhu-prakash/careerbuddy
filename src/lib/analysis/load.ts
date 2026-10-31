import "server-only";
import { db } from "@/lib/db";

/**
 * Everything downstream modules (plan, projects, interviews) need from a saved gap
 * analysis, scoped to the user. `gapAnalysisId` omitted = the user's latest analysis.
 * Returns null when the analysis doesn't exist or belongs to someone else.
 *
 * Item fields priority / category / requiredLevel / currentLevel / effortHours are set by
 * the F2 scorer; treat null as "unknown" and fall back to sensible defaults.
 */
export async function loadGapContext(userId: string, gapAnalysisId?: string) {
  const analysis = await db.gapAnalysis.findFirst({
    where: { userId, ...(gapAnalysisId ? { id: gapAnalysisId } : {}) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      matchScore: true,
      jdCount: true,
      resumeId: true,
      targetRole: {
        select: {
          id: true,
          title: true,
          seniority: true,
          hoursPerWeek: true,
          horizonWeeks: true,
          roleTrack: { select: { id: true, slug: true, title: true, family: true } },
        },
      },
      items: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          skillId: true,
          skillName: true,
          position: true,
          demand: true,
          have: true,
          gap: true,
          status: true,
          currentLevel: true,
          requiredLevel: true,
          priority: true,
          category: true,
          effortHours: true,
          fromTemplate: true,
          skill: { select: { id: true, slug: true, name: true, category: true } },
        },
      },
    },
  });
  if (!analysis) return null;

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { hoursPerWeek: true, targetDate: true },
  });

  return { ...analysis, budget: timeBudget(analysis.targetRole, user) };
}

export type GapContext = NonNullable<Awaited<ReturnType<typeof loadGapContext>>>;
export type GapContextItem = GapContext["items"][number];

const HORIZONS = [4, 8, 12, 16] as const;

/**
 * Weekly hours and plan length. Target role settings win, then the user's profile;
 * a target date is rounded up to the nearest supported horizon (4/8/12/16 weeks).
 */
export function timeBudget(
  role: { hoursPerWeek: number | null; horizonWeeks: number | null } | null,
  user: { hoursPerWeek: number; targetDate: Date | null },
  now = new Date(),
): { hoursPerWeek: number; weeks: number } {
  const hoursPerWeek = Math.max(1, role?.hoursPerWeek ?? user.hoursPerWeek);
  let weeks = role?.horizonWeeks ?? null;
  if (!weeks && user.targetDate) {
    const days = (user.targetDate.getTime() - now.getTime()) / 86_400_000;
    weeks = HORIZONS.find((h) => h * 7 >= days) ?? 16;
  }
  return { hoursPerWeek, weeks: weeks ?? 8 };
}
