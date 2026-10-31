// Skill-level rule (F6). Pure: every source of evidence about one skill goes in, one
// level (0 none .. 4 expert) comes out. Assessed evidence outweighs demonstrated, which
// outweighs self-reported; newer evidence counts more; one data point can't swing it far.

export type EvidenceKind = "assessed" | "demonstrated" | "self_reported" | "mentioned";

export type LevelEvidence = { kind: EvidenceKind; level: number; at: Date };

const KIND_WEIGHT: Record<EvidenceKind, number> = {
  assessed: 3,
  demonstrated: 2,
  self_reported: 1,
  mentioned: 0.5,
};

const HALF_LIFE_DAYS = 60;
// Without demonstrated or assessed evidence a skill can't be rated above intermediate.
const UNPROVEN_CAP = 2;

export function computeSkillLevel(
  evidence: LevelEvidence[],
  now = new Date(),
): { level: number; evidenceType: EvidenceKind } | null {
  if (evidence.length === 0) return null;

  let weighted = 0;
  let total = 0;
  for (const e of evidence) {
    const ageDays = Math.max(0, (now.getTime() - e.at.getTime()) / 86_400_000);
    const w = KIND_WEIGHT[e.kind] * 0.5 ** (ageDays / HALF_LIFE_DAYS);
    weighted += w * clampLevel(e.level);
    total += w;
  }

  const proven = evidence.some((e) => e.kind === "assessed" || e.kind === "demonstrated");
  let level = Math.round(weighted / total);
  if (!proven) level = Math.min(level, UNPROVEN_CAP);

  const evidenceType = (["assessed", "demonstrated", "self_reported", "mentioned"] as const).find((k) =>
    evidence.some((e) => e.kind === k),
  )!;
  return { level: clampLevel(level), evidenceType };
}

/** 0..1 score (interview overall / 100, assessment fraction) -> level 0..4. */
export function scoreToLevel(score: number): number {
  return clampLevel(Math.round(Math.min(1, Math.max(0, score)) * 4));
}

/** Self-rating 1..5 -> level 0..4. */
export function ratingToLevel(rating: number): number {
  return clampLevel(Math.round(rating) - 1);
}

function clampLevel(n: number): number {
  return Math.min(4, Math.max(0, Math.round(n)));
}
