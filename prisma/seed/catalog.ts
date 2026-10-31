// Contract and integrity checks for the curated seed data in ./data.
// Used by seed.ts before writing anything, and by tests/seed-data.test.ts.
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { normalizeSkillTerm } from "../../src/lib/skills/normalize";

export const TIERS = ["fundamental", "intermediate", "advanced"] as const;
export const SKILL_CATEGORIES = ["language", "framework", "cloud", "tool", "concept", "domain", "soft"] as const;

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug must be kebab-case");
const topicList = z.array(z.string().min(3).max(120)).min(2).max(6);

export const ResourceSchema = z.object({
  title: z.string().min(3).max(160),
  url: z.string().url().startsWith("https://"),
  kind: z.enum(["docs", "tutorial", "course", "book", "guide"]),
  tier: z.enum(TIERS),
});

export const SkillSeedSchema = z.object({
  slug,
  name: z.string().min(1).max(60),
  category: z.enum(SKILL_CATEGORIES),
  aliases: z.array(z.string().min(1).max(60)).default([]),
  description: z.string().min(10).max(240),
  prerequisites: z.array(slug).default([]),
  related: z.array(slug).default([]),
  topics: z.object({ fundamental: topicList, intermediate: topicList, advanced: topicList }),
  resources: z.array(ResourceSchema).min(1).max(4),
});

const RoleSkillSchema = z.object({
  skill: slug,
  level: z.number().int().min(1).max(4),
  importance: z.enum(["core", "recommended"]).default("core"),
  choiceGroup: z.string().regex(/^[a-z0-9-]+$/).nullable().default(null),
});

export const RoleSeedSchema = z.object({
  slug,
  title: z.string().min(3).max(80),
  family: z.enum(["engineering", "data", "ai", "quality", "security", "product"]),
  aliases: z.array(z.string().min(2).max(80)).min(1),
  description: z.string().min(10).max(300),
  skills: z.object({
    fundamental: z.array(RoleSkillSchema).min(2),
    intermediate: z.array(RoleSkillSchema).min(2),
    advanced: z.array(RoleSkillSchema).min(2),
  }),
});

export type SkillSeed = z.infer<typeof SkillSeedSchema>;
export type RoleSeed = z.infer<typeof RoleSeedSchema>;
export type Catalog = { skills: SkillSeed[]; roles: RoleSeed[] };

const DATA_DIR = path.join(__dirname, "data");

export function loadCatalog(dir = DATA_DIR): Catalog {
  const read = (file: string) => JSON.parse(readFileSync(path.join(dir, file), "utf8"));
  return {
    skills: z.array(SkillSeedSchema).parse(read("skills.json")),
    roles: z.array(RoleSeedSchema).parse(read("roles.json")),
  };
}

/** Cross-record checks Zod can't express. Returns a list of problems; empty means valid. */
export function checkCatalog({ skills, roles }: Catalog): string[] {
  const problems: string[] = [];
  const bySlug = new Map<string, SkillSeed>();

  for (const s of skills) {
    if (bySlug.has(s.slug)) problems.push(`duplicate skill slug "${s.slug}"`);
    bySlug.set(s.slug, s);
  }

  // Every name and alias must resolve to exactly one skill.
  const termOwner = new Map<string, string>();
  for (const s of skills) {
    for (const term of new Set([s.name, ...s.aliases].map(normalizeSkillTerm))) {
      const owner = termOwner.get(term);
      if (owner && owner !== s.slug) problems.push(`term "${term}" used by both "${owner}" and "${s.slug}"`);
      termOwner.set(term, s.slug);
    }
  }

  for (const s of skills) {
    for (const ref of [...s.prerequisites, ...s.related]) {
      if (!bySlug.has(ref)) problems.push(`skill "${s.slug}" references unknown skill "${ref}"`);
      if (ref === s.slug) problems.push(`skill "${s.slug}" references itself`);
    }
    for (const tier of TIERS) {
      const seen = new Set<string>();
      for (const t of s.topics[tier]) {
        if (seen.has(t.toLowerCase())) problems.push(`skill "${s.slug}" repeats topic "${t}" in ${tier}`);
        seen.add(t.toLowerCase());
      }
    }
  }

  const cycle = findPrereqCycle(skills);
  if (cycle) problems.push(`prerequisite cycle: ${cycle.join(" -> ")}`);

  const roleSlugs = new Set<string>();
  const roleAliasOwner = new Map<string, string>();
  for (const r of roles) {
    if (roleSlugs.has(r.slug)) problems.push(`duplicate role slug "${r.slug}"`);
    roleSlugs.add(r.slug);
    for (const a of r.aliases.map(normalizeSkillTerm)) {
      const owner = roleAliasOwner.get(a);
      if (owner && owner !== r.slug) problems.push(`role alias "${a}" used by both "${owner}" and "${r.slug}"`);
      roleAliasOwner.set(a, r.slug);
    }

    const inRole = new Set<string>();
    const groups = new Map<string, number>();
    for (const tier of TIERS) {
      // The advanced tier may be all "recommended": for some roles (e.g. data analyst)
      // advanced skills are stretch goals rather than hiring requirements.
      if (tier !== "advanced" && !r.skills[tier].some((x) => x.importance === "core")) {
        problems.push(`role "${r.slug}" has no core skill in ${tier}`);
      }
      for (const x of r.skills[tier]) {
        if (!bySlug.has(x.skill)) problems.push(`role "${r.slug}" uses unknown skill "${x.skill}"`);
        if (inRole.has(x.skill)) problems.push(`role "${r.slug}" lists "${x.skill}" more than once`);
        inRole.add(x.skill);
        if (x.choiceGroup) groups.set(x.choiceGroup, (groups.get(x.choiceGroup) ?? 0) + 1);
      }
    }
    for (const [g, n] of groups) {
      if (n < 2) problems.push(`role "${r.slug}" choice group "${g}" has only one option`);
    }
  }

  return problems;
}

/** Depth-first search over prerequisite edges; returns one cycle if any. */
function findPrereqCycle(skills: SkillSeed[]): string[] | null {
  const prereqs = new Map(skills.map((s) => [s.slug, s.prerequisites]));
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  const visit = (slug: string): string[] | null => {
    if (state.get(slug) === "done") return null;
    if (state.get(slug) === "visiting") return [...stack.slice(stack.indexOf(slug)), slug];
    state.set(slug, "visiting");
    stack.push(slug);
    for (const p of prereqs.get(slug) ?? []) {
      const c = visit(p);
      if (c) return c;
    }
    stack.pop();
    state.set(slug, "done");
    return null;
  };

  for (const s of skills) {
    const c = visit(s.slug);
    if (c) return c;
  }
  return null;
}
