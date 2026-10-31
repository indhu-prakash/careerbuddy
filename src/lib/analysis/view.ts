import "server-only";
import { db } from "@/lib/db";

/**
 * A saved gap analysis in the shape the UI renders. Used both right after an analysis
 * runs and when reopening one later, so reopening never calls the model again.
 */
export async function getGapAnalysisView(userId: string, id: string) {
  const a = await db.gapAnalysis.findFirst({
    where: { id, userId },
    select: {
      id: true,
      createdAt: true,
      matchScore: true,
      jdCount: true,
      candidate: true,
      recommendations: true,
      model: true,
      promptVersion: true,
      targetRole: {
        select: { id: true, title: true, roleTrack: { select: { slug: true, title: true } } },
      },
      jobDescriptions: {
        select: {
          jobDescription: {
            select: {
              id: true,
              title: true,
              company: true,
              source: true,
              requirements: { select: { skillId: true, evidenceQuote: true } },
            },
          },
        },
      },
      items: {
        orderBy: { position: "asc" },
        select: {
          skillId: true,
          skillName: true,
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
          evidence: true,
          skill: { select: { slug: true, category: true, curated: true } },
        },
      },
    },
  });
  if (!a) return null;

  const jds = a.jobDescriptions.map((j) => j.jobDescription);
  const quotesBySkill = new Map<string, string[]>();
  for (const jd of jds) {
    for (const r of jd.requirements) {
      if (!r.skillId || !r.evidenceQuote) continue;
      const list = quotesBySkill.get(r.skillId) ?? [];
      if (list.length < 3 && !list.includes(r.evidenceQuote)) list.push(r.evidenceQuote);
      quotesBySkill.set(r.skillId, list);
    }
  }

  return {
    id: a.id,
    createdAt: a.createdAt,
    matchScore: a.matchScore,
    jdCount: a.jdCount,
    usedTemplate: a.items.some((i) => i.fromTemplate) || (a.jdCount < 3 && !!a.targetRole?.roleTrack),
    candidate: a.candidate as { currentRole?: string; yearsExperience?: number | null; summary?: string } | null,
    recommendations: a.recommendations as string[],
    model: a.model,
    targetRole: a.targetRole,
    jobDescriptions: jds.map(({ requirements, ...jd }) => ({ ...jd, requirementCount: requirements.length })),
    gaps: a.items.map(({ skill, skillName, ...i }) => ({
      ...i,
      skill: skillName,
      slug: skill?.slug ?? null,
      skillCategory: skill?.category ?? null,
      curated: skill?.curated ?? false,
      jdQuotes: i.skillId ? (quotesBySkill.get(i.skillId) ?? []) : [],
    })),
  };
}

export type GapAnalysisView = NonNullable<Awaited<ReturnType<typeof getGapAnalysisView>>>;
