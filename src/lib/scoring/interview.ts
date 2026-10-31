// Deterministic interview scoring. The LLM scores each rubric criterion 1-5; this
// aligns those scores to the rubric and computes the overall score, so a criterion
// the model skipped or renamed can't silently inflate the result.

export type CriterionScore = { criterion: string; score: number; comment: string };

export type ScoredAnswer = {
  criteria: CriterionScore[]; // in rubric order, one per rubric criterion
  overallScore: number; // 0..100
};

export function scoreAnswer(rubric: { criterion: string }[], llmScores: CriterionScore[]): ScoredAnswer {
  const byName = new Map(llmScores.map((s) => [s.criterion.trim().toLowerCase(), s]));

  const criteria = rubric.map(({ criterion }) => {
    const s = byName.get(criterion.trim().toLowerCase());
    // A criterion the model didn't score counts as the minimum, not as missing.
    if (!s) return { criterion, score: 1, comment: "Not assessed." };
    return { criterion, score: Math.min(5, Math.max(1, Math.round(s.score))), comment: s.comment };
  });

  if (criteria.length === 0) return { criteria, overallScore: 0 };
  // Map the 1-5 scale onto 0-100 so 1 = 0 and 5 = 100.
  const mean = criteria.reduce((sum, c) => sum + c.score, 0) / criteria.length;
  return { criteria, overallScore: Math.round(((mean - 1) / 4) * 100) };
}

// ── Session report ──────────────────────────────────────────────────────────

export type ScoredQuestion = {
  skillId: string | null;
  skillName: string | null;
  overallScore: number; // 0..100
  criteria: { criterion: string; score: number }[];
  missingConcepts: string[];
};

export type SessionReport = {
  sessionScore: number | null; // 0..100, null when nothing was scored
  answered: number;
  criteria: { criterion: string; mean: number; count: number; low: number }[]; // weakest first
  recurringWeaknesses: { criterion: string; mean: number; count: number }[];
  skills: { skillId: string; skillName: string; mean: number; count: number }[]; // weakest first
  missingConcepts: { concept: string; count: number }[];
};

// A criterion is a recurring weakness when it scores ≤ 2 in at least this many answers.
const RECURRING_MIN = 2;
const MAX_CONCEPTS = 8;

/**
 * Aggregate a session's scored answers. The session score is the mean of the answer
 * scores (follow-ups count like any other answer); criteria are grouped by name.
 */
export function buildSessionReport(answers: ScoredQuestion[]): SessionReport {
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const byCriterion = new Map<string, { criterion: string; total: number; count: number; low: number }>();
  for (const a of answers) {
    for (const c of a.criteria) {
      const key = c.criterion.trim().toLowerCase();
      const entry = byCriterion.get(key) ?? { criterion: c.criterion, total: 0, count: 0, low: 0 };
      entry.total += c.score;
      entry.count += 1;
      if (c.score <= 2) entry.low += 1;
      byCriterion.set(key, entry);
    }
  }
  const criteria = [...byCriterion.values()]
    .map((c) => ({ criterion: c.criterion, mean: round1(c.total / c.count), count: c.count, low: c.low }))
    .sort((a, b) => a.mean - b.mean || b.count - a.count);

  const bySkill = new Map<string, { skillId: string; skillName: string; total: number; count: number }>();
  for (const a of answers) {
    if (!a.skillId) continue;
    const entry = bySkill.get(a.skillId) ?? { skillId: a.skillId, skillName: a.skillName ?? "", total: 0, count: 0 };
    entry.total += a.overallScore;
    entry.count += 1;
    bySkill.set(a.skillId, entry);
  }
  const skills = [...bySkill.values()]
    .map((s) => ({ skillId: s.skillId, skillName: s.skillName, mean: Math.round(s.total / s.count), count: s.count }))
    .sort((a, b) => a.mean - b.mean);

  // Same concept named by several answers (case-insensitive) counts once per answer.
  const concepts = new Map<string, { concept: string; count: number }>();
  for (const a of answers) {
    const seen = new Set<string>();
    for (const raw of a.missingConcepts) {
      const concept = raw.trim();
      const key = concept.toLowerCase();
      if (!concept || seen.has(key)) continue;
      seen.add(key);
      const entry = concepts.get(key) ?? { concept, count: 0 };
      entry.count += 1;
      concepts.set(key, entry);
    }
  }

  return {
    sessionScore: answers.length
      ? Math.round(answers.reduce((sum, a) => sum + a.overallScore, 0) / answers.length)
      : null,
    answered: answers.length,
    criteria,
    recurringWeaknesses: criteria
      .filter((c) => c.low >= RECURRING_MIN)
      .map(({ criterion, mean, count }) => ({ criterion, mean, count })),
    skills,
    missingConcepts: [...concepts.values()].sort((a, b) => b.count - a.count).slice(0, MAX_CONCEPTS),
  };
}
