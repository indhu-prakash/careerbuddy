import "server-only";
import { db } from "@/lib/db";
import { normalizeSkillTerm } from "@/lib/skills/normalize";
import { resolveSkills } from "@/lib/skills/resolve";

type StoredEvidence = { source?: string; level?: number; at?: string; quote?: string };

/** The user's skills inventory, strongest first, with the resume quote behind each entry. */
export async function listInventory(userId: string) {
  const rows = await db.userSkill.findMany({
    where: { userId },
    orderBy: [{ level: "desc" }, { skill: { name: "asc" } }],
    select: {
      skillId: true,
      level: true,
      evidenceType: true,
      confirmedByUser: true,
      evidence: true,
      skill: { select: { name: true, slug: true, category: true, curated: true } },
    },
  });
  return rows.map(({ evidence, skill, ...r }) => ({
    ...r,
    name: skill.name,
    slug: skill.slug,
    category: skill.category,
    curated: skill.curated,
    quote: (Array.isArray(evidence) ? (evidence as StoredEvidence[]) : []).find((e) => e?.quote)?.quote ?? null,
  }));
}

export type InventoryEdits = {
  /** Set a level (0..4) for an existing skill by id, or add one by name. */
  set?: { skillId?: string; name?: string; level: number }[];
  remove?: string[]; // skillIds
  /** Mark every remaining entry as reviewed by the user. */
  confirmAll?: boolean;
};

/**
 * F1 review step: the user confirms, corrects, adds or removes skills. A correction is
 * an explicit level: it's stored as user evidence and the entry is marked confirmed,
 * so later resume parses won't overwrite it.
 */
export async function updateInventory(userId: string, edits: InventoryEdits) {
  await db.$transaction(
    async (tx) => {
      if (edits.remove?.length) {
        await tx.userSkill.deleteMany({ where: { userId, skillId: { in: edits.remove } } });
      }

      const set = edits.set ?? [];
      const names = set.filter((s) => !s.skillId && s.name?.trim()).map((s) => s.name!.trim());
      const byName = names.length ? await resolveSkills(tx, names) : new Map<string, string>();
      const at = new Date().toISOString();

      for (const s of set) {
        const skillId = s.skillId ?? (s.name ? byName.get(normalizeSkillTerm(s.name)) : undefined);
        if (!skillId) continue;
        const level = Math.min(4, Math.max(0, Math.round(s.level)));
        const current = await tx.userSkill.findUnique({
          where: { userId_skillId: { userId, skillId } },
          select: { evidence: true },
        });
        const evidence = [
          ...((Array.isArray(current?.evidence) ? current.evidence : []) as StoredEvidence[]).filter(
            (e) => e?.source !== "user",
          ),
          { source: "user", level, at },
        ];
        await tx.userSkill.upsert({
          where: { userId_skillId: { userId, skillId } },
          create: { userId, skillId, level, evidenceType: "self_reported", evidence, confirmedByUser: true },
          update: { level, evidence, confirmedByUser: true },
        });
      }

      if (edits.confirmAll) {
        await tx.userSkill.updateMany({ where: { userId }, data: { confirmedByUser: true } });
      }
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
  return listInventory(userId);
}
