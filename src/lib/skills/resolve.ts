// Map skill names from LLM output to canonical rows in the skills taxonomy.
// Matching is by normalized name, alias or slug; unknown skills are added with
// curated = false so they can be reviewed and folded into the seed later.
import type { Prisma } from "@/generated/prisma/client";
import { normalizeSkillTerm } from "./normalize";

export type CatalogSkill = { id: string; slug: string; name: string; aliases: string[] };

/** Slug in the seed's style: "C#" -> "csharp", "Next.js" -> "nextjs", "CI/CD" -> "ci-cd". */
export function slugifySkill(name: string): string {
  return normalizeSkillTerm(name)
    .replace(/#/g, "sharp")
    .replace(/\+/g, "plus")
    .replace(/&/g, " and ")
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Index a catalog by every term that should resolve to each skill. */
export function buildSkillIndex(catalog: CatalogSkill[]): Map<string, CatalogSkill> {
  const index = new Map<string, CatalogSkill>();
  // Names win over aliases, and aliases over slugs, when two skills claim the same term.
  for (const s of catalog) index.set(`slug:${s.slug}`, s);
  for (const s of catalog) for (const a of s.aliases) index.set(`term:${normalizeSkillTerm(a)}`, s);
  for (const s of catalog) index.set(`term:${normalizeSkillTerm(s.name)}`, s);
  return index;
}

export function lookupSkill(index: Map<string, CatalogSkill>, name: string): CatalogSkill | undefined {
  return index.get(`term:${normalizeSkillTerm(name)}`) ?? index.get(`slug:${slugifySkill(name)}`);
}

/**
 * Resolve names to skill ids, creating uncurated skills for names not in the taxonomy.
 * Returns a map keyed by normalizeSkillTerm(name). Loads the whole catalog, which is
 * small (hundreds of rows); switch to a targeted query if it grows large.
 */
export async function resolveSkills(
  tx: Prisma.TransactionClient,
  names: string[],
): Promise<Map<string, string>> {
  const wanted = [...new Map(names.filter((n) => n.trim()).map((n) => [normalizeSkillTerm(n), n.trim()])).entries()];
  const select = { id: true, slug: true, name: true, aliases: true } as const;
  let index = buildSkillIndex(await tx.skill.findMany({ select }));

  const missing = wanted.filter(([, name]) => !lookupSkill(index, name) && slugifySkill(name));
  if (missing.length > 0) {
    await tx.skill.createMany({
      data: missing.map(([, name]) => ({ name, slug: slugifySkill(name), curated: false })),
      skipDuplicates: true,
    });
    index = buildSkillIndex(await tx.skill.findMany({ select }));
  }

  const ids = new Map<string, string>();
  for (const [key, name] of wanted) {
    const skill = lookupSkill(index, name);
    if (skill) ids.set(key, skill.id);
  }
  return ids;
}
