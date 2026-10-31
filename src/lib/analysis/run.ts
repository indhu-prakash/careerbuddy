import "server-only";
import { db } from "@/lib/db";
import { ingestJobDescriptions, type JdInput } from "@/lib/analysis/jobs";
import { getGapAnalysisView } from "@/lib/analysis/view";
import { getPrimaryResume, ingestResume, type ResumeFile, type VerifiedProfile } from "@/lib/intake/resume";
import { findOrCreateTargetRole, getActiveTargetRole } from "@/lib/intake/target-role";
import {
  gapRecommendations,
  scoreGapMap,
  type HeldSkill,
  type Requirement,
  type TemplateSkill,
} from "@/lib/scoring/gap-map";
import { cleanRoleTitle } from "@/lib/skills/roles";
import { normalizeSkillTerm } from "@/lib/skills/normalize";

export class MissingResumeError extends Error {
  constructor() {
    super("No resume yet");
  }
}

/**
 * F2: compare the user's profile against job descriptions and save the gap map.
 * Model calls happen only for a resume or JD the user hasn't submitted before; the
 * scores come from the user's skills inventory (so review-step corrections and interview
 * results count) and, with fewer than 3 JDs, the matched role template.
 */
export async function runGapAnalysis(input: {
  userId: string;
  resume?: { text: string; file?: ResumeFile | null } | null; // omitted = use the saved primary resume
  jds: JdInput[];
  targetRoleTitle?: string | null;
}) {
  const { userId } = input;

  let resumeId: string;
  let profile: VerifiedProfile | null;
  if (input.resume?.text) {
    ({ resumeId, profile } = await ingestResume({ userId, ...input.resume }));
  } else {
    const saved = await getPrimaryResume(userId);
    if (!saved) throw new MissingResumeError();
    resumeId = saved.id;
    profile = saved.parsed as VerifiedProfile | null;
  }

  // Target role: as typed, else the active one, else from the first JD's title.
  let targetRoleId = input.targetRoleTitle?.trim()
    ? await findOrCreateTargetRole(db, userId, input.targetRoleTitle.trim())
    : ((await getActiveTargetRole(userId))?.id ?? null);
  const jds = await ingestJobDescriptions(userId, input.jds, targetRoleId);
  if (!targetRoleId && jds[0]?.title) {
    targetRoleId = await findOrCreateTargetRole(db, userId, cleanRoleTitle(jds[0].title, jds[0].company));
    await db.jobDescription.updateMany({ where: { id: { in: jds.map((j) => j.id) } }, data: { targetRoleId } });
  }
  const role = targetRoleId
    ? await db.targetRole.findUnique({
        where: { id: targetRoleId },
        select: { title: true, roleTrackId: true },
      })
    : null;

  const keyOf = (skillId: string | null, name: string) => skillId ?? `name:${normalizeSkillTerm(name)}`;
  const requirements: Requirement[][] = jds.map((jd) =>
    jd.requirements.map((r) => ({
      key: keyOf(r.skillId, r.skillName),
      skillId: r.skillId,
      name: r.skillName,
      required: r.required,
      requiredLevel: r.requiredLevel,
      domain: r.domain,
      quote: r.quote,
    })),
  );

  const template: TemplateSkill[] =
    role?.roleTrackId && jds.length < 3
      ? (
          await db.roleTrackSkill.findMany({
            where: { trackId: role.roleTrackId },
            select: {
              skillId: true,
              requiredLevel: true,
              importance: true,
              choiceGroup: true,
              skill: { select: { name: true } },
            },
          })
        ).map((t) => ({
          key: t.skillId,
          skillId: t.skillId,
          name: t.skill.name,
          requiredLevel: t.requiredLevel,
          importance: t.importance,
          choiceGroup: t.choiceGroup,
        }))
      : [];

  const inventory = await db.userSkill.findMany({
    where: { userId },
    select: { skillId: true, level: true, evidence: true, skill: { select: { name: true } } },
  });
  const held: HeldSkill[] = inventory.map((s) => ({
    key: s.skillId,
    level: s.level,
    quote:
      (Array.isArray(s.evidence) ? (s.evidence as { quote?: string }[]) : []).find((e) => e?.quote)?.quote ?? null,
  }));

  const skillIds = [...new Set([...requirements.flat().map((r) => r.skillId), ...template.map((t) => t.skillId)])]
    .filter((id): id is string => !!id);
  const edges = await db.skillEdge.findMany({
    where: { kind: "related", fromSkillId: { in: skillIds } },
    select: { fromSkillId: true, toSkillId: true },
  });
  const related = new Map<string, string[]>();
  for (const e of edges) related.set(e.fromSkillId, [...(related.get(e.fromSkillId) ?? []), e.toSkillId]);
  const names = new Map(inventory.map((s) => [s.skillId, s.skill.name]));

  const { matchScore, items } = scoreGapMap({ jds: requirements, template, held, related, names });
  const recommendations = gapRecommendations(items, { jdCount: jds.length, roleTitle: role?.title });

  const analysis = await db.gapAnalysis.create({
    data: {
      userId,
      targetRoleId,
      resumeId,
      matchScore,
      jdCount: jds.length,
      candidate: {
        currentRole: profile?.currentRole ?? "",
        yearsExperience: profile?.yearsExperience ?? null,
        summary: profile?.summary ?? "",
      },
      recommendations,
      promptVersion: "gap-map@2",
      items: {
        create: items.map((i, position) => ({
          skillId: i.skillId,
          skillName: i.skillName,
          position,
          demand: i.demand,
          have: i.have,
          gap: i.gap,
          status: i.status,
          currentLevel: i.currentLevel,
          requiredLevel: i.requiredLevel,
          priority: i.priority,
          category: i.category,
          effortHours: i.effortHours,
          fromTemplate: i.fromTemplate,
          evidence: i.evidence,
        })),
      },
      jobDescriptions: { create: jds.map((jd) => ({ jobDescriptionId: jd.id })) },
    },
    select: { id: true },
  });

  return (await getGapAnalysisView(userId, analysis.id))!;
}
