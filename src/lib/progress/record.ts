import "server-only";
import { db } from "@/lib/db";
import type { Prisma, PrismaClient, ProgressKind } from "@/generated/prisma/client";
import {
  computeSkillLevel,
  ratingToLevel,
  scoreToLevel,
  type EvidenceKind,
  type LevelEvidence,
} from "@/lib/scoring/progress";

type Client = PrismaClient | Prisma.TransactionClient;

/**
 * Value conventions for ProgressEvent.value:
 * - interview_scored, assessment_scored: score as a fraction 0..1
 * - skill_level_changed: the user's self-rating 1..5
 * Other kinds don't use value (hours go in `hours`).
 */
export type ProgressInput = {
  userId: string;
  kind: ProgressKind;
  taskId?: string | null;
  skillId?: string | null;
  refId?: string | null;
  hours?: number | null;
  value?: number | null;
  note?: string | null;
  meta?: Prisma.InputJsonValue;
  occurredAt?: Date;
};

const LEVEL_KINDS = new Set<ProgressKind>(["interview_scored", "assessment_scored", "skill_level_changed"]);

/**
 * Append a progress event. Events that carry skill evidence (scores, self-ratings)
 * also recompute that skill's level in the user's inventory.
 * Pass a transaction client to make it part of a larger write.
 */
export async function recordProgress(input: ProgressInput, client: Client = db): Promise<void> {
  await client.progressEvent.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      taskId: input.taskId ?? null,
      skillId: input.skillId ?? null,
      refId: input.refId ?? null,
      hours: input.hours ?? null,
      value: input.value ?? null,
      note: input.note ?? null,
      meta: input.meta,
      occurredAt: input.occurredAt,
    },
  });
  if (input.skillId && LEVEL_KINDS.has(input.kind)) {
    await refreshSkillLevel(client, input.userId, input.skillId);
  }
}

/** Baseline evidence stored on UserSkill.evidence by intake (resume) and review (user). */
type StoredEvidence = { source: "resume" | "user"; level?: number; at?: string; quote?: string };

/** Recompute one skill's level from stored baseline evidence plus scored events. */
export async function refreshSkillLevel(client: Client, userId: string, skillId: string) {
  const [skill, events] = await Promise.all([
    client.userSkill.findUnique({
      where: { userId_skillId: { userId, skillId } },
      select: { level: true, evidenceType: true, evidence: true, createdAt: true },
    }),
    client.progressEvent.findMany({
      where: { userId, skillId, kind: { in: [...LEVEL_KINDS] }, value: { not: null } },
      select: { kind: true, value: true, occurredAt: true },
    }),
  ]);

  const evidence: LevelEvidence[] = [];
  for (const e of (Array.isArray(skill?.evidence) ? skill.evidence : []) as StoredEvidence[]) {
    if (typeof e?.level !== "number") continue;
    const kind: EvidenceKind =
      e.source === "user" ? "self_reported" : skill!.evidenceType === "demonstrated" ? "demonstrated" : "mentioned";
    evidence.push({ kind, level: e.level, at: e.at ? new Date(e.at) : skill!.createdAt });
  }
  for (const e of events) {
    evidence.push(
      e.kind === "skill_level_changed"
        ? { kind: "self_reported", level: ratingToLevel(e.value!), at: e.occurredAt }
        : { kind: "assessed", level: scoreToLevel(e.value!), at: e.occurredAt },
    );
  }

  const result = computeSkillLevel(evidence);
  if (!result) return;
  if (skill) {
    if (skill.level === result.level && skill.evidenceType === result.evidenceType) return;
    await client.userSkill.update({
      where: { userId_skillId: { userId, skillId } },
      data: { level: result.level, evidenceType: result.evidenceType },
    });
  } else {
    await client.userSkill.create({
      data: { userId, skillId, level: result.level, evidenceType: result.evidenceType },
    });
  }
}
