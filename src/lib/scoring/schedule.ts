// Learning-plan scheduler (F3). Pure: gaps, prerequisite edges and a time budget go in;
// a week-by-week skeleton of tasks comes out. Code decides which skills, in what order,
// in which week and for how many hours; the LLM only writes wording for the result.
// F6 replans call `scheduleLearning` again with the remaining gaps, the remaining weeks
// and `doneHours`, so the same rules apply to every plan version.

export type Tier = "fundamental" | "intermediate" | "advanced";
export type ScheduledTaskKind = "learn" | "exercise" | "coding" | "assessment";
export type GapCategory = "must_have" | "good_to_have" | "advanced" | "domain";

/** One skill to close. Nullable fields fall back to defaults derived from demand/have. */
export type ScheduleGap = {
  /** Stable key: the catalog skill id, or any unique string for skills outside the catalog. */
  skillId: string;
  name: string;
  /** 0..1, weighted share of JDs asking for it. */
  demand: number;
  /** 0..1, demand * (1 - have). Gaps <= 0 are ignored. */
  gap: number;
  /** 0 | 0.5 | 1, evidence in the resume. Used only to default currentLevel. */
  have?: number | null;
  category?: GapCategory | null;
  /** Precomputed rank score (F2: importance x frequency / effort). Overrides the default. */
  priority?: number | null;
  /** 0..4. Defaults from `have`: 1 -> 2, 0.5 -> 1, else 0. */
  currentLevel?: number | null;
  /** 1..4, job-ready level. Defaults to 2 (intermediate), and always at least currentLevel + 1. */
  requiredLevel?: number | null;
  /** Hours to close the gap. Defaults to the sum of HOURS_TO_REACH for each missing level. */
  effortHours?: number | null;
  /** Catalog category (language | framework | tool | ...). Hands-on categories get coding tasks. */
  skillCategory?: string | null;
};

/** `from` must be learned before `to` (SkillEdge kind = prereq). */
export type PrereqEdge = { from: string; to: string };

export type ScheduleInput = {
  gaps: ScheduleGap[];
  prereqs: PrereqEdge[];
  /** Names/categories of skills that may be pulled in as missing prerequisites. */
  skillInfo?: Record<string, { name: string; category?: string | null }>;
  /** Skills the user already has; never pulled in as prerequisites. */
  known?: Iterable<string>;
  /** Number of weeks to fill (for a replan: the weeks left). */
  weeks: number;
  hoursPerWeek: number;
  /** Replan: hours already completed per skill; that much is trimmed from the front of its tasks. */
  doneHours?: Record<string, number>;
  /** Share of hoursPerWeek kept free for spillover. Default 0.15. */
  slack?: number;
  /** Share of the remaining budget kept for project milestones (F4). Default 0. */
  projectShare?: number;
  /** Number given to the first week (a replan starting at week 5 passes 5). Default 1. */
  firstWeekNumber?: number;
  /** How many top-ranked gaps must be covered. Default 5. */
  topN?: number;
};

export type ScheduledTask = {
  skillId: string;
  kind: ScheduledTaskKind;
  tier: Tier;
  estHours: number;
  /** Index of this task among the skill's tasks of the same kind and tier (for topic titles). */
  part: number;
  /** Number of tasks of that kind and tier for the skill. */
  parts: number;
  /** True when this piece continues a task split across a week boundary. */
  continued: boolean;
};

export type ScheduledWeek = { weekNumber: number; hours: number; tasks: ScheduledTask[] };

export type ScheduledSkill = {
  skillId: string;
  name: string;
  rank: number;
  /** Not in the gaps: added because a scheduled gap needs it first. */
  pulledIn: boolean;
  hours: number;
  tiers: Tier[];
  firstWeek: number;
  lastWeek: number;
};

export type DeferredSkill = {
  skillId: string;
  name: string;
  hours: number;
  pulledIn: boolean;
  reason: "no_time" | "prereq_deferred";
};

export type ScheduleResult = {
  /** Hours per week available to learning tasks (after slack and project share). */
  capacityPerWeek: number;
  weeks: ScheduledWeek[];
  /** In schedule order (prerequisites first). */
  skills: ScheduledSkill[];
  deferred: DeferredSkill[];
  coverage: CoverageReport;
};

export type CoverageReport = {
  /** Top-ranked gap skill ids, best first. */
  top: string[];
  /** Top gaps that are not in the plan; non-empty means the plan must say so loudly. */
  missing: { skillId: string; name: string }[];
  ok: boolean;
};

/** Hours to go from level n-1 to level n. */
export const HOURS_TO_REACH: Record<number, number> = { 1: 6, 2: 10, 3: 14, 4: 18 };
const CATEGORY_WEIGHT: Record<GapCategory, number> = {
  must_have: 1,
  domain: 0.8,
  good_to_have: 0.6,
  advanced: 0.5,
};
const HANDS_ON = new Set(["language", "framework", "tool", "cloud", "database", "library", "platform"]);
const MAX_CHUNK_HOURS = 3;

export function tierForLevel(level: number): Tier {
  return level <= 1 ? "fundamental" : level === 2 ? "intermediate" : "advanced";
}

const roundHalf = (x: number) => Math.round(x * 2) / 2;
const floorHalf = (x: number) => Math.floor(x * 2 + 1e-9) / 2;

function levels(g: ScheduleGap): { from: number; to: number } {
  const have = g.have ?? (g.demand > 0 ? 1 - g.gap / g.demand : 0);
  const from = clamp(g.currentLevel ?? (have >= 1 ? 2 : have >= 0.5 ? 1 : 0), 0, 3);
  const to = clamp(Math.max(g.requiredLevel ?? 2, from + 1), 1, 4);
  return { from, to };
}

/** Effort in hours: the gap's own estimate, or the catalog default for its level range. */
export function effortFor(g: ScheduleGap): number {
  if (g.effortHours && g.effortHours > 0) return g.effortHours;
  const { from, to } = levels(g);
  let h = 0;
  for (let l = from + 1; l <= to; l++) h += HOURS_TO_REACH[l];
  return h;
}

/** Rank score, higher first: priority if F2 set it, else importance x frequency / effort. */
export function rankScore(g: ScheduleGap): number {
  if (g.priority != null && Number.isFinite(g.priority)) return g.priority;
  const importance = g.category ? CATEGORY_WEIGHT[g.category] : 1;
  return (importance * Math.max(0, g.gap) * 10) / Math.max(1, effortFor(g));
}

/** Gaps with something left to close, best first (ties: bigger gap, then name). */
export function rankGaps<T extends ScheduleGap>(gaps: T[]): T[] {
  return gaps
    .filter((g) => g.gap > 0)
    .map((g) => ({ g, r: rankScore(g) }))
    .sort((a, b) => b.r - a.r || b.g.gap - a.g.gap || a.g.name.localeCompare(b.g.name))
    .map((x) => x.g);
}

/**
 * Tasks for one skill, in learning order: for each level to climb, learn then practice
 * at that level's tier; a short assessment closes the skill. Pieces are at most
 * `maxChunk` hours so they pack into weeks.
 */
export function tasksForSkill(g: ScheduleGap, maxChunk = MAX_CHUNK_HOURS): Omit<ScheduledTask, "continued">[] {
  const { from, to } = levels(g);
  const effort = effortFor(g);
  const weights: { tier: Tier; w: number }[] = [];
  for (let l = from + 1; l <= to; l++) weights.push({ tier: tierForLevel(l), w: HOURS_TO_REACH[l] });
  const totalW = weights.reduce((n, s) => n + s.w, 0);

  const assessment = effort >= 3 ? 1 : 0;
  const practiceKind: ScheduledTaskKind = HANDS_ON.has(g.skillCategory ?? "") ? "coding" : "exercise";
  const out: Omit<ScheduledTask, "continued">[] = [];
  const push = (kind: ScheduledTaskKind, tier: Tier, hours: number) => {
    if (hours < 0.5) return;
    const n = Math.ceil(hours / maxChunk - 1e-9);
    let left = roundHalf(hours);
    for (let i = 0; i < n; i++) {
      const h = i === n - 1 ? left : Math.max(0.5, roundHalf(hours / n));
      left = roundHalf(left - h);
      if (h >= 0.5) out.push({ skillId: g.skillId, kind, tier, estHours: h, part: i, parts: n });
    }
  };
  for (const { tier, w } of weights) {
    const stage = ((effort - assessment) * w) / totalW;
    const learn = roundHalf(stage / 2);
    push("learn", tier, learn);
    push(practiceKind, tier, stage - learn);
  }
  if (assessment) {
    const last = weights[weights.length - 1].tier;
    out.push({ skillId: g.skillId, kind: "assessment", tier: last, estHours: assessment, part: 0, parts: 1 });
  }
  return out;
}

/** Trim `done` hours off the front of a task list (replan: work already completed). */
function trimDone<T extends { estHours: number }>(tasks: T[], done: number): T[] {
  let left = done;
  const out: T[] = [];
  for (const t of tasks) {
    if (left >= t.estHours) {
      left -= t.estHours;
      continue;
    }
    const h = roundHalf(t.estHours - left);
    left = 0;
    if (h >= 0.5) out.push({ ...t, estHours: h });
  }
  return out;
}

type Node = ScheduleGap & { pulledIn: boolean; rank: number; effective: number };

/**
 * Build the plan skeleton. Guarantees:
 * - no week holds more than `capacityPerWeek` (<= hoursPerWeek * (1 - slack)) hours;
 * - a skill's tasks never come before its prerequisites' tasks (same week = later position);
 * - missing prerequisites (not in gaps, not known) are pulled in at fundamental level;
 * - a skill that doesn't fit, or whose prerequisite was deferred, is listed in `deferred`;
 * - `coverage` names any top-N gap that isn't in the plan.
 */
export function scheduleLearning(input: ScheduleInput): ScheduleResult {
  const slack = input.slack ?? 0.15;
  const weeksCount = Math.max(0, Math.floor(input.weeks));
  const capacity = floorHalf(input.hoursPerWeek * (1 - slack) * (1 - (input.projectShare ?? 0)));
  const firstWeek = input.firstWeekNumber ?? 1;
  const known = new Set(input.known ?? []);
  const done = input.doneHours ?? {};

  // 1. Rank the gaps.
  const ranked = rankGaps(input.gaps);
  const nodes = new Map<string, Node>();
  for (const g of ranked) {
    if (!nodes.has(g.skillId)) nodes.set(g.skillId, { ...g, pulledIn: false, rank: rankScore(g), effective: 0 });
  }

  // 2. Pull in missing prerequisites, transitively.
  const prereqsOf = new Map<string, string[]>();
  for (const e of input.prereqs) {
    if (e.from === e.to) continue;
    prereqsOf.set(e.to, [...(prereqsOf.get(e.to) ?? []), e.from]);
  }
  const queue = [...nodes.keys()];
  while (queue.length) {
    const id = queue.shift()!;
    for (const p of prereqsOf.get(id) ?? []) {
      if (nodes.has(p) || known.has(p)) continue;
      const info = input.skillInfo?.[p];
      if (!info) continue; // unknown skill: can't name it, so don't schedule it
      nodes.set(p, {
        skillId: p,
        name: info.name,
        demand: 0,
        gap: 0,
        currentLevel: 0,
        requiredLevel: 1,
        skillCategory: info.category ?? null,
        pulledIn: true,
        rank: 0,
        effective: 0,
      });
      queue.push(p);
    }
  }

  // A prerequisite inherits the rank of the most important skill that needs it, so it is
  // scheduled just ahead of that skill rather than at the end.
  const dependentsOf = new Map<string, string[]>();
  for (const [to, froms] of prereqsOf) {
    if (!nodes.has(to)) continue;
    for (const f of froms) if (nodes.has(f)) dependentsOf.set(f, [...(dependentsOf.get(f) ?? []), to]);
  }
  const memo = new Map<string, number>();
  const effective = (id: string, seen: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (seen.has(id)) return nodes.get(id)!.rank; // cycle guard
    seen.add(id);
    let best = nodes.get(id)!.rank;
    for (const d of dependentsOf.get(id) ?? []) best = Math.max(best, effective(d, seen));
    seen.delete(id);
    memo.set(id, best);
    return best;
  };
  for (const n of nodes.values()) n.effective = effective(n.skillId, new Set());

  // 3. Topological order (Kahn), taking the highest effective rank among ready skills.
  const inDeg = new Map<string, number>();
  for (const id of nodes.keys()) {
    inDeg.set(id, (prereqsOf.get(id) ?? []).filter((p) => nodes.has(p) && p !== id).length);
  }
  const byRank = (a: Node, b: Node) =>
    b.effective - a.effective || Number(a.pulledIn) - Number(b.pulledIn) || b.rank - a.rank || a.name.localeCompare(b.name);
  const order: Node[] = [];
  const ready = [...nodes.values()].filter((n) => inDeg.get(n.skillId) === 0);
  const placed = new Set<string>();
  while (order.length < nodes.size) {
    if (!ready.length) {
      // Cycle in the prereq data: break it at the most important remaining skill.
      const rest = [...nodes.values()].filter((n) => !placed.has(n.skillId)).sort(byRank);
      ready.push(rest[0]);
    }
    ready.sort(byRank);
    const n = ready.shift()!;
    if (placed.has(n.skillId)) continue;
    placed.add(n.skillId);
    order.push(n);
    for (const d of dependentsOf.get(n.skillId) ?? []) {
      const left = inDeg.get(d)! - 1;
      inDeg.set(d, left);
      if (left === 0 && !placed.has(d)) ready.push(nodes.get(d)!);
    }
  }

  // 4. Greedy packing, skill by skill in order. A skill is placed whole or deferred.
  const weeks: ScheduledWeek[] = Array.from({ length: weeksCount }, (_, i) => ({
    weekNumber: firstWeek + i,
    hours: 0,
    tasks: [],
  }));
  let cursor = 0; // week index being filled
  const skills: ScheduledSkill[] = [];
  const deferred: DeferredSkill[] = [];
  const deferredIds = new Set<string>();
  const chunk = Math.max(0.5, Math.min(MAX_CHUNK_HOURS, capacity));

  for (const n of order) {
    const tasks = trimDone(tasksForSkill(n, chunk), done[n.skillId] ?? 0);
    const hours = tasks.reduce((s, t) => s + t.estHours, 0);
    if (!tasks.length) continue; // already completed
    const blocked = (prereqsOf.get(n.skillId) ?? []).some((p) => deferredIds.has(p));
    const base = { skillId: n.skillId, name: n.name, hours, pulledIn: n.pulledIn };
    if (blocked) {
      deferred.push({ ...base, reason: "prereq_deferred" });
      deferredIds.add(n.skillId);
      continue;
    }

    // Simulate on a copy so a skill that overflows the timeline leaves no partial tasks.
    const used = weeks.map((w) => w.hours);
    const pieces: { week: number; task: ScheduledTask }[] = [];
    let w = cursor;
    let fits = capacity > 0;
    for (const t of tasks) {
      let left = t.estHours;
      let first = true;
      while (fits && left > 0) {
        const room = capacity - used[w];
        // Don't start a task in a sliver of a week; move on instead.
        if (w < weeksCount && room >= Math.min(left, 1)) {
          const put = Math.min(left, floorHalf(room));
          pieces.push({ week: w, task: { ...t, estHours: put, continued: !first } });
          used[w] += put;
          left = roundHalf(left - put);
          first = false;
        } else if (++w >= weeksCount) {
          fits = false;
        }
      }
      if (!fits) break;
    }
    if (!fits) {
      deferred.push({ ...base, reason: "no_time" });
      deferredIds.add(n.skillId);
      continue;
    }
    for (const p of pieces) {
      weeks[p.week].tasks.push(p.task);
      weeks[p.week].hours = roundHalf(weeks[p.week].hours + p.task.estHours);
    }
    cursor = w;
    skills.push({
      ...base,
      rank: n.rank,
      tiers: [...new Set(tasks.map((t) => t.tier))],
      firstWeek: weeks[pieces[0].week].weekNumber,
      lastWeek: weeks[pieces[pieces.length - 1].week].weekNumber,
    });
  }

  return {
    capacityPerWeek: capacity,
    weeks,
    skills,
    deferred,
    coverage: checkCoverage(
      ranked,
      skills.map((s) => s.skillId),
      input.topN ?? 5,
    ),
  };
}

/** Which of the top-N ranked gaps (by `rankGaps`) are missing from `plannedSkillIds`. */
export function checkCoverage(
  gaps: ScheduleGap[],
  plannedSkillIds: Iterable<string>,
  topN = 5,
): CoverageReport {
  const planned = new Set(plannedSkillIds);
  const top = rankGaps(gaps).slice(0, topN);
  const missing = top.filter((g) => !planned.has(g.skillId)).map((g) => ({ skillId: g.skillId, name: g.name }));
  return { top: top.map((g) => g.skillId), missing, ok: missing.length === 0 };
}

export type MilestoneInput = {
  key: string;
  estHours: number;
  /** First week number this milestone may go in (e.g. when its skills start). */
  earliestWeek: number;
};

/**
 * Place project milestones (F4) into existing plan weeks without exceeding
 * `capacityPerWeek`. Each project's milestones keep their order, starting at or after
 * the previous one's last week. A milestone that is bigger than a week's free room is
 * split into pieces (>= 1 h, or the remainder) over the following weeks; one that can't
 * be placed whole goes to `unplaced` and leaves no pieces.
 */
export function placeMilestones(
  weeks: { weekNumber: number; usedHours: number }[],
  projects: MilestoneInput[][],
  capacityPerWeek: number,
): { placed: { key: string; weekNumber: number; hours: number }[]; unplaced: string[] } {
  const sorted = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const used = new Map(sorted.map((w) => [w.weekNumber, w.usedHours]));
  const placed: { key: string; weekNumber: number; hours: number }[] = [];
  const unplaced: string[] = [];
  for (const milestones of projects) {
    let minWeek = -Infinity;
    for (const m of milestones) {
      const from = Math.max(minWeek, m.earliestWeek);
      const pieces: { key: string; weekNumber: number; hours: number }[] = [];
      let left = m.estHours;
      for (const w of sorted) {
        if (left <= 0) break;
        if (w.weekNumber < from) continue;
        const room = floorHalf(capacityPerWeek - used.get(w.weekNumber)!);
        if (room < Math.min(left, 1)) continue;
        const put = Math.min(left, room);
        pieces.push({ key: m.key, weekNumber: w.weekNumber, hours: put });
        left = roundHalf(left - put);
      }
      if (left > 0) {
        unplaced.push(m.key);
        continue;
      }
      for (const p of pieces) used.set(p.weekNumber, used.get(p.weekNumber)! + p.hours);
      placed.push(...pieces);
      minWeek = pieces[pieces.length - 1].weekNumber;
    }
  }
  return { placed, unplaced };
}

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}
