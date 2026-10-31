import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { Prisma, type RequirementCategory } from "@/generated/prisma/client";
import { runAiTask } from "@/lib/ai/service";
import { buildPrompt, JdExtractionSchema, PROMPT_VERSION, SYSTEM } from "@/lib/ai/prompts/jd-extract";
import { quoteInSource, verifiedQuote } from "@/lib/analysis/quotes";
import { normalizeSkillTerm } from "@/lib/skills/normalize";
import { resolveSkills } from "@/lib/skills/resolve";

export type JdInput = { text: string; source: "pasted" | "file" };

export type IngestedJd = {
  id: string;
  title: string | null;
  company: string | null;
  seniority: string | null;
  requirements: {
    skillId: string | null;
    skillName: string;
    required: boolean;
    requiredLevel: number | null;
    domain: boolean;
    quote: string | null;
  }[];
};

/**
 * F2: save JDs and their requirements. JDs the user already added (same text) are reused
 * without another model call; all new ones are extracted in a single request. A
 * requirement is kept only if its quote is verbatim in the JD or the skill is named in
 * the text, which filters out requirements the model made up.
 */
export async function ingestJobDescriptions(
  userId: string,
  jds: JdInput[],
  targetRoleId: string | null,
): Promise<IngestedJd[]> {
  const inputs = dedupe(jds.map((jd) => ({ ...jd, hash: sha256(jd.text) })));
  const existing = new Map(
    (
      await db.jobDescription.findMany({
        where: { userId, contentHash: { in: inputs.map((i) => i.hash) }, NOT: { parsed: { equals: Prisma.DbNull } } },
        select: { id: true, contentHash: true, title: true, company: true, parsed: true, requirements: true },
      })
    ).map((jd) => [jd.contentHash!, jd]),
  );

  const toExtract = inputs.filter((i) => !existing.has(i.hash));
  const extracted = new Map<string, IngestedJd>();
  if (toExtract.length > 0) {
    const { data } = await runAiTask({
      task: "jd.extract",
      promptVersion: PROMPT_VERSION,
      userId,
      system: SYSTEM,
      prompt: buildPrompt(toExtract.map((jd, i) => ({ index: i + 1, text: jd.text }))),
      schema: JdExtractionSchema,
      maxTokens: 16000,
    });

    const saved = await db.$transaction(
      async (tx) => {
        const names = data.jobDescriptions.flatMap((jd) => jd.requirements.map((r) => r.skill));
        const ids = await resolveSkills(tx, names);
        const out: [string, IngestedJd][] = [];

        for (const [i, input] of toExtract.entries()) {
          const jd = data.jobDescriptions.find((j) => j.index === i + 1);
          const text = normalizeSkillTerm(input.text);
          const seen = new Set<string>();
          const requirements = (jd?.requirements ?? [])
            .filter((r) => quoteInSource(input.text, r.quote) || text.includes(normalizeSkillTerm(r.skill)))
            .map((r) => ({
              skillId: ids.get(normalizeSkillTerm(r.skill)) ?? null,
              skillName: r.skill.trim(),
              required: r.required,
              requiredLevel: r.requiredLevel,
              domain: r.domain,
              quote: verifiedQuote(input.text, r.quote),
            }))
            .filter((r) => {
              const key = r.skillId ?? normalizeSkillTerm(r.skillName);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });

          const fields = {
            title: jd?.title.trim() || null,
            company: jd?.company.trim() || null,
            // Left null when the model skipped this JD, so the next analysis retries it.
            parsed: jd ? { seniority: jd.seniority, model: PROMPT_VERSION } : undefined,
            ...(targetRoleId ? { targetRoleId } : {}),
          };
          const row = await tx.jobDescription.upsert({
            where: { userId_contentHash: { userId, contentHash: input.hash } },
            create: { userId, source: input.source, rawText: input.text, contentHash: input.hash, ...fields },
            update: fields,
            select: { id: true },
          });
          await tx.jobRequirement.deleteMany({ where: { jobDescriptionId: row.id } });
          if (requirements.length) {
            await tx.jobRequirement.createMany({
              data: requirements.map((r) => ({
                jobDescriptionId: row.id,
                userId,
                skillId: r.skillId,
                skillName: r.skillName,
                kind: r.required ? ("must" as const) : ("nice" as const),
                category: categoryOf(r),
                requiredLevel: r.requiredLevel,
                evidenceQuote: r.quote,
              })),
            });
          }
          out.push([
            input.hash,
            { id: row.id, title: fields.title, company: fields.company, seniority: jd?.seniority || null, requirements },
          ]);
        }
        return out;
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
    for (const [hash, jd] of saved) extracted.set(hash, jd);
  }

  if (targetRoleId && existing.size > 0) {
    await db.jobDescription.updateMany({
      where: { userId, id: { in: [...existing.values()].map((e) => e.id) } },
      data: { targetRoleId },
    });
  }

  return inputs.map((input) => {
    const fresh = extracted.get(input.hash);
    if (fresh) return fresh;
    const jd = existing.get(input.hash)!;
    return {
      id: jd.id,
      title: jd.title,
      company: jd.company,
      seniority: ((jd.parsed as { seniority?: string } | null)?.seniority ?? "") || null,
      requirements: jd.requirements.map((r) => ({
        skillId: r.skillId,
        skillName: r.skillName,
        required: r.kind === "must",
        requiredLevel: r.requiredLevel,
        domain: r.category === "domain",
        quote: r.evidenceQuote,
      })),
    };
  });
}

function categoryOf(r: { required: boolean; domain: boolean }): RequirementCategory {
  return r.domain ? "domain" : r.required ? "must_have" : "good_to_have";
}

function dedupe<T extends { hash: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.hash) ? false : (seen.add(i.hash), true)));
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
