import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { EvidenceType, Prisma } from "@/generated/prisma/client";
import { runAiTask } from "@/lib/ai/service";
import {
  buildPrompt,
  PROMPT_VERSION,
  ResumeProfileSchema,
  SYSTEM,
  type ResumeProfile,
} from "@/lib/ai/prompts/resume-extract";
import { verifiedQuote } from "@/lib/analysis/quotes";
import { normalizeSkillTerm } from "@/lib/skills/normalize";
import { resolveSkills } from "@/lib/skills/resolve";
import { RESUME_BUCKET, RESUME_MIME_TYPES, resumeObjectPath } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ResumeFile = { name: string; mimeType: string; bytes: Uint8Array };

/** Extracted skills with quotes checked: unverifiable quotes are removed. */
export type VerifiedProfile = Omit<ResumeProfile, "skills"> & {
  skills: { name: string; evidenceType: "demonstrated" | "mentioned"; quote: string | null }[];
};

/**
 * F1: parse a resume once and save it as the user's primary resume, with draft skills
 * inventory entries. The same text is never sent to the model twice: an already-parsed
 * resume (same SHA-256) is reused as-is.
 */
export async function ingestResume(input: { userId: string; text: string; file?: ResumeFile | null }) {
  const { userId, text } = input;
  const sha256 = createHash("sha256").update(text).digest("hex");

  const existing = await db.resume.findUnique({
    where: { userId_sha256: { userId, sha256 } },
    select: { id: true, parsed: true, status: true },
  });
  if (existing?.status === "parsed" && existing.parsed) {
    await setPrimary(db, userId, existing.id);
    return { resumeId: existing.id, profile: existing.parsed as VerifiedProfile, reused: true };
  }

  const { data, model } = await runAiTask({
    task: "resume.extract",
    promptVersion: PROMPT_VERSION,
    userId,
    system: SYSTEM,
    prompt: buildPrompt(text),
    schema: ResumeProfileSchema,
    maxTokens: 16000,
  });
  const profile = verifyProfile(text, data);

  const resumeId = await db.$transaction(
    async (tx) => {
      const resume = await tx.resume.upsert({
        where: { userId_sha256: { userId, sha256 } },
        create: {
          userId,
          sha256,
          rawText: text,
          fileName: input.file?.name ?? null,
          mimeType: input.file?.mimeType ?? null,
          parsed: { ...profile, model },
          status: "parsed",
        },
        update: { parsed: { ...profile, model }, status: "parsed", parseError: null },
        select: { id: true },
      });
      await setPrimary(tx, userId, resume.id);
      await upsertDraftSkills(tx, userId, resume.id, profile);

      // Fill profile fields the user hasn't set yet.
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { currentRole: true, yearsExperience: true },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          currentRole: user.currentRole ?? (profile.currentRole || null),
          yearsExperience: user.yearsExperience ?? profile.yearsExperience,
        },
      });
      return resume.id;
    },
    { maxWait: 10_000, timeout: 30_000 },
  );

  if (input.file) await storeResumeFile(userId, resumeId, input.file);
  return { resumeId, profile, reused: false };
}

/** Drop quotes that aren't verbatim in the resume; without proof a skill is only "mentioned". */
export function verifyProfile(text: string, profile: ResumeProfile): VerifiedProfile {
  const seen = new Set<string>();
  const skills: VerifiedProfile["skills"] = [];
  for (const s of profile.skills) {
    const key = normalizeSkillTerm(s.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const quote = verifiedQuote(text, s.quote);
    skills.push({ name: s.name.trim(), evidenceType: quote ? s.evidenceType : "mentioned", quote });
  }
  return { ...profile, skills };
}

async function setPrimary(client: Prisma.TransactionClient, userId: string, resumeId: string) {
  await client.resume.updateMany({ where: { userId, NOT: { id: resumeId } }, data: { isPrimary: false } });
  await client.resume.update({ where: { id: resumeId }, data: { isPrimary: true } });
}

// Draft levels: demonstrated -> 2 (intermediate), mentioned -> 1 (beginner); the resume
// alone can't show more. Entries the user confirmed or edited are never overwritten.
async function upsertDraftSkills(
  tx: Prisma.TransactionClient,
  userId: string,
  resumeId: string,
  profile: VerifiedProfile,
) {
  const ids = await resolveSkills(tx, profile.skills.map((s) => s.name));
  const at = new Date().toISOString();
  const drafts = new Map<string, { level: number; evidenceType: EvidenceType; quote: string | null }>();
  for (const s of profile.skills) {
    const skillId = ids.get(normalizeSkillTerm(s.name));
    if (!skillId) continue;
    const draft = {
      level: s.evidenceType === "demonstrated" ? 2 : 1,
      evidenceType: s.evidenceType as EvidenceType,
      quote: s.quote,
    };
    const prev = drafts.get(skillId);
    if (!prev || draft.level > prev.level) drafts.set(skillId, draft);
  }
  if (drafts.size === 0) return;

  const existing = new Map(
    (
      await tx.userSkill.findMany({
        where: { userId, skillId: { in: [...drafts.keys()] } },
        select: { skillId: true, confirmedByUser: true },
      })
    ).map((e) => [e.skillId, e.confirmedByUser]),
  );
  // Baseline evidence read by the level rule (src/lib/progress/record.ts).
  const evidence = (d: { level: number; quote: string | null }) => [
    { source: "resume", refId: resumeId, level: d.level, at, ...(d.quote ? { quote: d.quote } : {}) },
  ];

  await tx.userSkill.createMany({
    data: [...drafts]
      .filter(([id]) => !existing.has(id))
      .map(([skillId, d]) => ({
        userId,
        skillId,
        level: d.level,
        evidenceType: d.evidenceType,
        evidence: evidence(d),
        sourceResumeId: resumeId,
      })),
    skipDuplicates: true,
  });
  for (const [skillId, d] of drafts) {
    if (existing.get(skillId) !== false) continue; // just created, or confirmed by the user
    await tx.userSkill.update({
      where: { userId_skillId: { userId, skillId } },
      data: { level: d.level, evidenceType: d.evidenceType, evidence: evidence(d), sourceResumeId: resumeId },
    });
  }
}

// The private bucket only accepts PDF/DOCX; pasted or .txt resumes keep just the text.
async function storeResumeFile(userId: string, resumeId: string, file: ResumeFile) {
  if (!(RESUME_MIME_TYPES as readonly string[]).includes(file.mimeType)) return;
  try {
    const path = resumeObjectPath(userId, resumeId, file.mimeType);
    const { error } = await createSupabaseAdminClient()
      .storage.from(RESUME_BUCKET)
      .upload(path, file.bytes, { contentType: file.mimeType, upsert: true });
    if (error) throw error;
    await db.resume.update({ where: { id: resumeId }, data: { storagePath: path } });
  } catch (error) {
    // The text is already saved; a storage failure shouldn't fail onboarding.
    console.warn("[resume] storing file failed", error);
  }
}

/** The user's primary (latest) resume with its parsed profile, or null. */
export async function getPrimaryResume(userId: string) {
  return db.resume.findFirst({
    where: { userId, status: "parsed" },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    select: { id: true, fileName: true, createdAt: true, parsed: true, rawText: true, storagePath: true },
  });
}
