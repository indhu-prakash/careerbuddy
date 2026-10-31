import { describe, expect, it } from "vitest";
import { evaluateTriggers, type SkillState, type WeekProgress } from "@/lib/scoring/replan";

const week = (weekNumber: number, plannedHours: number, actualHours: number, extra: Partial<WeekProgress> = {}): WeekProgress => ({
  weekNumber,
  plannedHours,
  actualHours,
  ended: true,
  checkpointsPassed: null,
  ...extra,
});

const skill = (extra: Partial<SkillState>): SkillState => ({
  skillId: "s1",
  name: "Python",
  level: 1,
  requiredLevel: 3,
  hasRemainingTasks: true,
  latestScore: null,
  ...extra,
});

describe("evaluateTriggers", () => {
  it("fires 'behind' after two weeks under 70% of planned hours", () => {
    const t = evaluateTriggers({ weeks: [week(1, 10, 6), week(2, 10, 5)], skills: [] });
    expect(t.map((x) => x.kind)).toEqual(["behind"]);
    expect(t[0].reason).toContain("60% and 50%");
  });

  it("doesn't fire 'behind' for a single slow week", () => {
    expect(evaluateTriggers({ weeks: [week(1, 10, 10), week(2, 10, 3)], skills: [] })).toEqual([]);
  });

  it("ignores weeks that haven't ended yet", () => {
    expect(evaluateTriggers({ weeks: [week(1, 10, 2), week(2, 10, 0, { ended: false })], skills: [] })).toEqual([]);
  });

  it("fires 'ahead' over 120% only when checkpoints weren't failed", () => {
    const ahead = evaluateTriggers({
      weeks: [week(1, 10, 13, { checkpointsPassed: true }), week(2, 10, 14, { checkpointsPassed: null })],
      skills: [],
    });
    expect(ahead.map((x) => x.kind)).toEqual(["ahead"]);
    const failed = evaluateTriggers({
      weeks: [week(1, 10, 13, { checkpointsPassed: false }), week(2, 10, 14)],
      skills: [],
    });
    expect(failed).toEqual([]);
  });

  it("fires 'mastered' for skills at the required level that still have tasks", () => {
    const t = evaluateTriggers({
      weeks: [],
      skills: [
        skill({ skillId: "a", name: "SQL", level: 3, requiredLevel: 3 }),
        skill({ skillId: "b", name: "Docker", level: 3, requiredLevel: 2, hasRemainingTasks: false }),
      ],
    });
    expect(t).toEqual([expect.objectContaining({ kind: "mastered", skillIds: ["a"] })]);
  });

  it("fires 'weak' when the latest score is under 50%", () => {
    const t = evaluateTriggers({
      weeks: [],
      skills: [skill({ skillId: "a", latestScore: 0.4 }), skill({ skillId: "b", name: "Go", latestScore: 0.5 })],
    });
    expect(t).toEqual([expect.objectContaining({ kind: "weak", skillIds: ["a"] })]);
  });
});

describe("diffTasks", () => {
  it("names added, removed and moved tasks", async () => {
    const { diffTasks } = await import("@/lib/scoring/replan");
    const before = [
      { title: "Learn SQL joins", skill: "SQL", weekNumber: 3 },
      { title: "Docker basics", skill: "Docker", weekNumber: 4 },
      { title: "Python OOP", skill: "Python", weekNumber: 5 },
    ];
    const after = [
      { title: "Learn SQL joins", skill: "SQL", weekNumber: 3 },
      { title: "Python OOP", skill: "Python", weekNumber: 4 },
      { title: "Python reinforcement drills", skill: "Python", weekNumber: 5 },
    ];
    expect(diffTasks(before, after)).toEqual({
      added: [{ title: "Python reinforcement drills", skill: "Python", weekNumber: 5 }],
      removed: [{ title: "Docker basics", skill: "Docker", weekNumber: 4 }],
      moved: [{ title: "Python OOP", from: 5, to: 4 }],
    });
  });
});
