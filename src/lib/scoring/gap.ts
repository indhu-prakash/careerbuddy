// Deterministic gap scoring (PLAN.md §4). The LLM extracts skills; this scores them.

export type JDSkill = { skill: string; required: boolean };
export type ResumeEvidence = { skill: string; have: 0 | 0.5 | 1; evidence?: string };

export type GapItem = {
  skill: string;
  demand: number; // 0..1
  have: number; // 0 | 0.5 | 1
  gap: number; // demand * (1 - have)
  status: "matched" | "partial" | "missing";
  evidence?: string;
};

export function scoreGaps(
  jds: JDSkill[][],
  resume: ResumeEvidence[],
): { matchScore: number; items: GapItem[] } {
  const n = jds.length;
  if (n === 0) return { matchScore: 0, items: [] };

  const demand = new Map<string, number>();
  for (const jd of jds) {
    // Count each skill once per JD, keeping the stronger (required) weight.
    const perJd = new Map<string, number>();
    for (const { skill, required } of jd) {
      const key = skill.toLowerCase();
      perJd.set(key, Math.max(perJd.get(key) ?? 0, required ? 1 : 0.5));
    }
    for (const [key, w] of perJd) demand.set(key, (demand.get(key) ?? 0) + w / n);
  }

  const haveByKey = new Map(resume.map((r) => [r.skill.toLowerCase(), r]));
  const displayName = new Map<string, string>();
  for (const jd of jds) for (const s of jd) displayName.set(s.skill.toLowerCase(), s.skill);

  let num = 0;
  let den = 0;
  const items: GapItem[] = [];
  for (const [key, d] of demand) {
    const r = haveByKey.get(key);
    const have = r?.have ?? 0;
    num += d * have;
    den += d;
    items.push({
      skill: displayName.get(key) ?? key,
      demand: d,
      have,
      gap: d * (1 - have),
      status: have === 1 ? "matched" : have === 0.5 ? "partial" : "missing",
      evidence: r?.evidence,
    });
  }

  items.sort((a, b) => b.gap - a.gap || b.demand - a.demand);
  return { matchScore: den ? num / den : 0, items };
}
