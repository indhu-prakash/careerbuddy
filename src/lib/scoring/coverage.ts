// Portfolio project selection (F4). Pure greedy weighted set cover: the LLM proposes
// candidate projects tagged with skills; code picks the 2-4 that together cover the most
// gap weight and reports which top gaps no chosen project covers.

export type ProjectCandidate = {
  key: string;
  /** Skill ids the project demonstrates (already validated against the catalog). */
  skills: string[];
};

export type SelectOptions = {
  min?: number; // default 2
  max?: number; // default 4
  /** Top gap skill ids, best first. Selection stops early once all are covered (and min is met). */
  top?: string[];
  /** Candidates must demonstrate at least this many weighted gap skills. Default 2. */
  minGapSkills?: number;
};

export type SelectionResult = {
  /** Chosen candidate keys, in pick order. */
  chosen: string[];
  /** For every weighted skill: the chosen candidates that cover it (empty = uncovered). */
  coveredBy: Record<string, string[]>;
  /** Top skill ids that no chosen project covers. */
  uncoveredTop: string[];
};

/**
 * Each round picks the candidate covering the most still-uncovered gap weight (ties: more
 * total gap weight, then input order). Stops at `max`, when nothing adds coverage, or when
 * every top gap is covered and `min` projects are chosen. If coverage runs out before `min`,
 * the remaining picks go to the candidates with the most total gap weight (reinforcement).
 */
export function selectProjects(
  candidates: ProjectCandidate[],
  weights: Map<string, number>,
  opts: SelectOptions = {},
): SelectionResult {
  const min = opts.min ?? 2;
  const max = Math.max(min, opts.max ?? 4);
  const top = opts.top ?? [];
  const weightOf = (id: string) => Math.max(0, weights.get(id) ?? 0);
  const gapSkills = (c: ProjectCandidate) => [...new Set(c.skills)].filter((s) => weightOf(s) > 0);

  let pool = candidates.filter((c) => gapSkills(c).length >= (opts.minGapSkills ?? 2));
  // Too few strong candidates: fall back to anything that touches a gap at all.
  if (pool.length < min) pool = candidates.filter((c) => gapSkills(c).length > 0);

  const covered = new Set<string>();
  const chosen: ProjectCandidate[] = [];
  const total = (c: ProjectCandidate) => gapSkills(c).reduce((n, s) => n + weightOf(s), 0);
  const gain = (c: ProjectCandidate) =>
    gapSkills(c).reduce((n, s) => n + (covered.has(s) ? 0 : weightOf(s)), 0);

  while (chosen.length < max) {
    if (chosen.length >= min && top.every((t) => covered.has(t))) break;
    const left = pool.filter((c) => !chosen.includes(c));
    if (!left.length) break;
    let best = left[0];
    for (const c of left.slice(1)) {
      const d = gain(c) - gain(best);
      if (d > 1e-12 || (Math.abs(d) <= 1e-12 && total(c) > total(best) + 1e-12)) best = c;
    }
    if (gain(best) <= 0 && chosen.length >= min) break;
    chosen.push(best);
    for (const s of gapSkills(best)) covered.add(s);
  }

  const coveredBy: Record<string, string[]> = {};
  for (const [id, w] of weights) {
    if (w > 0) coveredBy[id] = chosen.filter((c) => c.skills.includes(id)).map((c) => c.key);
  }
  return {
    chosen: chosen.map((c) => c.key),
    coveredBy,
    uncoveredTop: top.filter((t) => !covered.has(t)),
  };
}
