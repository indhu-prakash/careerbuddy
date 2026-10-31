import { describe, expect, it } from "vitest";
import {
  checkCoverage,
  effortFor,
  placeMilestones,
  rankGaps,
  scheduleLearning,
  tasksForSkill,
  type ScheduleGap,
  type ScheduleResult,
} from "@/lib/scoring/schedule";

const gap = (skillId: string, g: number, extra: Partial<ScheduleGap> = {}): ScheduleGap => ({
  skillId,
  name: skillId.toUpperCase(),
  demand: g,
  gap: g,
  have: 0,
  ...extra,
});

/** Week index (0-based) and in-plan position of every task, for order assertions. */
function positions(result: ScheduleResult) {
  const first = new Map<string, number>();
  const last = new Map<string, number>();
  let i = 0;
  for (const w of result.weeks) {
    for (const t of w.tasks) {
      if (!first.has(t.skillId)) first.set(t.skillId, i);
      last.set(t.skillId, i);
      i++;
    }
  }
  return { first, last };
}

describe("rankGaps", () => {
  it("uses F2 priority when present, else importance x gap / effort", () => {
    const ranked = rankGaps([
      gap("a", 0.5),
      gap("b", 0.9),
      gap("c", 0.2, { priority: 100 }),
      gap("d", 0.9, { category: "advanced" }),
      gap("e", 0, {}), // nothing to close
    ]);
    expect(ranked.map((g) => g.skillId)).toEqual(["c", "b", "a", "d"]);
  });

  it("ranks cheaper skills higher at equal gap", () => {
    const ranked = rankGaps([gap("big", 0.8, { effortHours: 40 }), gap("small", 0.8, { effortHours: 8 })]);
    expect(ranked[0].skillId).toBe("small");
  });
});

describe("tasksForSkill", () => {
  it("defaults effort from levels and ends with an assessment", () => {
    const g = gap("ts", 1, { skillCategory: "language" }); // level 0 -> 2
    expect(effortFor(g)).toBe(16);
    const tasks = tasksForSkill(g);
    expect(tasks.at(-1)?.kind).toBe("assessment");
    expect(tasks.some((t) => t.kind === "coding")).toBe(true);
    expect(tasks.every((t) => t.estHours <= 3 && t.estHours >= 0.5)).toBe(true);
    expect(tasks[0]).toMatchObject({ kind: "learn", tier: "fundamental" });
    expect(tasks.map((t) => t.tier)).toContain("intermediate");
    const total = tasks.reduce((n, t) => n + t.estHours, 0);
    expect(Math.abs(total - 16)).toBeLessThanOrEqual(1);
  });

  it("partial skills start at a higher tier with exercises for concepts", () => {
    const tasks = tasksForSkill(gap("sd", 0.5, { have: 0.5, skillCategory: "concept" }));
    expect(tasks[0].tier).toBe("intermediate");
    expect(tasks.some((t) => t.kind === "exercise")).toBe(true);
  });
});

describe("scheduleLearning", () => {
  const gaps = [
    gap("react", 0.9, { skillCategory: "framework" }),
    gap("ts", 0.8, { skillCategory: "language" }),
    gap("docker", 0.6, { skillCategory: "tool" }),
    gap("aws", 0.5, { skillCategory: "cloud" }),
    gap("testing", 0.4),
    gap("graphql", 0.3),
  ];
  const prereqs = [
    { from: "js", to: "react" },
    { from: "js", to: "ts" },
    { from: "html", to: "js" },
    { from: "linux", to: "docker" },
  ];
  const skillInfo = {
    js: { name: "JavaScript", category: "language" },
    html: { name: "HTML", category: "language" },
    linux: { name: "Linux", category: "tool" },
  };

  it("never exceeds the weekly capacity and keeps ~15% slack", () => {
    const r = scheduleLearning({ gaps, prereqs, skillInfo, weeks: 8, hoursPerWeek: 10 });
    expect(r.capacityPerWeek).toBe(8.5);
    expect(r.weeks).toHaveLength(8);
    for (const w of r.weeks) {
      expect(w.hours).toBeLessThanOrEqual(8.5);
      expect(w.tasks.reduce((n, t) => n + t.estHours, 0)).toBeCloseTo(w.hours);
    }
  });

  it("pulls in missing prerequisites and schedules them first", () => {
    const r = scheduleLearning({ gaps, prereqs, skillInfo, known: ["linux"], weeks: 12, hoursPerWeek: 10 });
    const ids = r.skills.map((s) => s.skillId);
    expect(ids).toContain("js");
    expect(ids).toContain("html");
    expect(ids).not.toContain("linux"); // already known
    expect(r.skills.find((s) => s.skillId === "js")?.pulledIn).toBe(true);

    const { first, last } = positions(r);
    for (const { from, to } of prereqs) {
      if (!first.has(from) || !first.has(to)) continue;
      expect(last.get(from)!).toBeLessThan(first.get(to)!);
    }
    // The prerequisite chain is placed right before the top-ranked skill that needs it.
    expect(ids.slice(0, 3)).toEqual(["html", "js", "react"]);
  });

  it("defers what doesn't fit and reports uncovered top gaps", () => {
    const r = scheduleLearning({ gaps, prereqs: [], weeks: 2, hoursPerWeek: 10 });
    expect(r.deferred.length).toBeGreaterThan(0);
    expect(r.deferred.every((d) => d.reason === "no_time")).toBe(true);
    expect(r.coverage.ok).toBe(false);
    expect(r.coverage.top).toHaveLength(5);
    expect(r.coverage.missing.map((m) => m.skillId)).toEqual(
      r.coverage.top.filter((id) => !r.skills.some((s) => s.skillId === id)),
    );
    // Every scheduled skill is placed whole.
    for (const s of r.skills) {
      const placed = r.weeks.flatMap((w) => w.tasks).filter((t) => t.skillId === s.skillId);
      expect(placed.reduce((n, t) => n + t.estHours, 0)).toBeCloseTo(s.hours);
    }
  });

  it("defers dependents of a deferred prerequisite", () => {
    const r = scheduleLearning({
      gaps: [gap("a", 0.9, { effortHours: 100 }), gap("b", 0.8, { effortHours: 4 })],
      prereqs: [{ from: "a", to: "b" }],
      weeks: 4,
      hoursPerWeek: 10,
    });
    expect(r.skills).toHaveLength(0);
    expect(r.deferred).toEqual([
      expect.objectContaining({ skillId: "a", reason: "no_time" }),
      expect.objectContaining({ skillId: "b", reason: "prereq_deferred" }),
    ]);
  });

  it("covers all top-5 gaps when time allows", () => {
    const r = scheduleLearning({ gaps, prereqs, skillInfo, weeks: 16, hoursPerWeek: 10 });
    expect(r.coverage).toMatchObject({ ok: true, missing: [] });
    expect(r.deferred).toEqual([]);
  });

  it("reserves a project share of each week", () => {
    const r = scheduleLearning({ gaps, prereqs: [], weeks: 8, hoursPerWeek: 10, projectShare: 0.2 });
    expect(r.capacityPerWeek).toBe(6.5);
    expect(Math.max(...r.weeks.map((w) => w.hours))).toBeLessThanOrEqual(6.5);
  });

  it("replans: trims done hours, drops finished skills and numbers weeks from an offset", () => {
    const base = { gaps, prereqs: [], weeks: 6, hoursPerWeek: 10, firstWeekNumber: 5 };
    const full = scheduleLearning(base);
    const react = full.skills.find((s) => s.skillId === "react")!;
    const r = scheduleLearning({ ...base, doneHours: { react: react.hours, ts: 4 } });
    expect(r.weeks[0].weekNumber).toBe(5);
    expect(r.skills.some((s) => s.skillId === "react")).toBe(false);
    const ts = r.skills.find((s) => s.skillId === "ts")!;
    expect(ts.hours).toBeCloseTo(full.skills.find((s) => s.skillId === "ts")!.hours - 4);
  });

  it("survives cycles in the prerequisite data", () => {
    const r = scheduleLearning({
      gaps: [gap("a", 0.9), gap("b", 0.8)],
      prereqs: [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ],
      weeks: 8,
      hoursPerWeek: 10,
    });
    expect(r.skills.map((s) => s.skillId).sort()).toEqual(["a", "b"]);
  });

  it("handles tiny budgets without looping", () => {
    const r = scheduleLearning({ gaps, prereqs: [], weeks: 4, hoursPerWeek: 1 });
    expect(r.skills).toEqual([]);
    expect(r.deferred).toHaveLength(gaps.length);
  });
});

describe("checkCoverage", () => {
  it("lists top gaps that aren't planned", () => {
    const c = checkCoverage([gap("a", 0.9), gap("b", 0.5), gap("c", 0.1)], ["a"], 2);
    expect(c).toEqual({ top: ["a", "b"], missing: [{ skillId: "b", name: "B" }], ok: false });
  });
});

describe("placeMilestones", () => {
  it("keeps order, respects earliest week and capacity, reports what doesn't fit", () => {
    const weeks = [1, 2, 3, 4].map((n) => ({ weekNumber: n, usedHours: n === 2 ? 6 : 4 }));
    const r = placeMilestones(
      weeks,
      [
        [
          { key: "p1-m1", estHours: 2, earliestWeek: 2 },
          { key: "p1-m2", estHours: 2, earliestWeek: 1 },
        ],
        [{ key: "p2-m1", estHours: 5, earliestWeek: 1 }],
      ],
      7,
    );
    expect(r.placed).toEqual([
      // week 2 has 1 h free, so the milestone is split across weeks 2 and 3
      { key: "p1-m1", weekNumber: 2, hours: 1 },
      { key: "p1-m1", weekNumber: 3, hours: 1 },
      { key: "p1-m2", weekNumber: 3, hours: 2 },
      // another project uses whatever room is left
      { key: "p2-m1", weekNumber: 1, hours: 3 },
      { key: "p2-m1", weekNumber: 4, hours: 2 },
    ]);
    expect(r.unplaced).toEqual([]);
  });

  it("places a milestone whole or not at all", () => {
    const weeks = [1, 2].map((n) => ({ weekNumber: n, usedHours: 4 }));
    const r = placeMilestones(weeks, [[{ key: "big", estHours: 7, earliestWeek: 1 }, { key: "small", estHours: 1, earliestWeek: 1 }]], 7);
    expect(r.unplaced).toEqual(["big"]);
    expect(r.placed).toEqual([{ key: "small", weekNumber: 1, hours: 1 }]);
  });

  it("does not start before the earliest week", () => {
    const weeks = [1, 2].map((n) => ({ weekNumber: n, usedHours: 0 }));
    const r = placeMilestones(weeks, [[{ key: "m", estHours: 1, earliestWeek: 2 }]], 5);
    expect(r.placed).toEqual([{ key: "m", weekNumber: 2, hours: 1 }]);
  });
});
