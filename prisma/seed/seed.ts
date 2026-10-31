// Loads the curated skill taxonomy and role tracks from ./data into Postgres.
// Idempotent: re-running updates curated rows in place and replaces their topics,
// edges, resources and role-skill lists. Skills the app created itself
// (curated = false) are never touched.
//
//   npm run db:seed              write to the database (DIRECT_URL, else DATABASE_URL)
//   npm run db:seed -- --dry-run validate the data and print counts only
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { normalizeSkillTerm } from "../../src/lib/skills/normalize";
import { checkCatalog, loadCatalog, TIERS } from "./catalog";

async function main() {
  const catalog = loadCatalog();
  const problems = checkCatalog(catalog);
  if (problems.length > 0) {
    throw new Error(`Seed data is invalid:\n- ${problems.join("\n- ")}`);
  }
  const { skills, roles } = catalog;
  const topicCount = skills.reduce((n, s) => n + TIERS.reduce((m, t) => m + s.topics[t].length, 0), 0);
  const resourceCount = skills.reduce((n, s) => n + s.resources.length, 0);
  console.log(`Catalog OK: ${skills.length} skills, ${topicCount} topics, ${resourceCount} resources, ${roles.length} roles.`);
  if (process.argv.includes("--dry-run")) return;

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL must be set");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1 }) });

  try {
    await db.$transaction(
      async (tx) => {
        // Match existing rows by slug, or by name for skills created before the seed existed.
        const existing = await tx.skill.findMany({
          where: {
            OR: [
              { slug: { in: skills.map((s) => s.slug) } },
              { name: { in: skills.map((s) => s.name), mode: "insensitive" } },
            ],
          },
          select: { id: true, slug: true, name: true },
        });
        const idBySlug = new Map<string, string>();
        for (const s of skills) {
          const match =
            existing.find((e) => e.slug === s.slug) ??
            existing.find((e) => e.name.toLowerCase() === s.name.toLowerCase());
          const data = {
            slug: s.slug,
            name: s.name,
            category: s.category,
            description: s.description,
            curated: true,
            aliases: [...new Set(s.aliases.map(normalizeSkillTerm))].filter(
              (a) => a !== normalizeSkillTerm(s.name),
            ),
          };
          const row = match
            ? await tx.skill.update({ where: { id: match.id }, data, select: { id: true } })
            : await tx.skill.create({ data, select: { id: true } });
          idBySlug.set(s.slug, row.id);
        }
        const ids = [...idBySlug.values()];
        const id = (slug: string) => idBySlug.get(slug)!;

        await tx.skillTopic.deleteMany({ where: { skillId: { in: ids } } });
        await tx.skillTopic.createMany({
          data: skills.flatMap((s) =>
            TIERS.flatMap((tier) =>
              s.topics[tier].map((title, position) => ({ skillId: id(s.slug), tier, position, title })),
            ),
          ),
        });

        await tx.skillEdge.deleteMany({ where: { fromSkillId: { in: ids }, toSkillId: { in: ids } } });
        await tx.skillEdge.createMany({
          skipDuplicates: true,
          data: skills.flatMap((s) => [
            ...s.prerequisites.map((p) => ({ fromSkillId: id(p), toSkillId: id(s.slug), kind: "prereq" as const })),
            // Related is symmetric; store both directions so lookups need one column.
            ...s.related.flatMap((r) => [
              { fromSkillId: id(s.slug), toSkillId: id(r), kind: "related" as const },
              { fromSkillId: id(r), toSkillId: id(s.slug), kind: "related" as const },
            ]),
          ]),
        });

        await tx.learningResource.deleteMany({ where: { skillId: { in: ids }, curated: true } });
        await tx.learningResource.createMany({
          skipDuplicates: true,
          data: skills.flatMap((s) => s.resources.map((r) => ({ ...r, skillId: id(s.slug), curated: true }))),
        });

        for (const r of roles) {
          const track = await tx.roleTrack.upsert({
            where: { slug: r.slug },
            create: {
              slug: r.slug, title: r.title, family: r.family, description: r.description,
              aliases: [...new Set(r.aliases.map(normalizeSkillTerm))],
            },
            update: {
              title: r.title, family: r.family, description: r.description,
              aliases: [...new Set(r.aliases.map(normalizeSkillTerm))],
            },
            select: { id: true },
          });
          await tx.roleTrackSkill.deleteMany({ where: { trackId: track.id } });
          await tx.roleTrackSkill.createMany({
            data: TIERS.flatMap((tier) =>
              r.skills[tier].map((x) => ({
                trackId: track.id,
                skillId: id(x.skill),
                tier,
                requiredLevel: x.level,
                importance: x.importance,
                choiceGroup: x.choiceGroup,
              })),
            ),
          });
        }
      },
      { timeout: 180_000, maxWait: 20_000 },
    );
    console.log("Seed written.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
