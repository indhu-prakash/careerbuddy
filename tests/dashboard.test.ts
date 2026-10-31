import { describe, expect, it } from "vitest";
import { activityStreak, hoursByWeek, readiness } from "@/lib/scoring/dashboard";

describe("readiness", () => {
  const items = [
    { skillId: "a", demand: 1, requiredLevel: 3, currentLevel: 1 },
    { skillId: "b", demand: 0.5, requiredLevel: 2, currentLevel: 0 },
  ];

  it("uses current levels rather than the levels at analysis time", () => {
    expect(readiness(items, new Map())).toBeCloseTo(0.5 / 1.5, 3); // a partial, b missing
    expect(readiness(items, new Map([["a", 3], ["b", 2]]))).toBe(1);
  });

  it("is 0 with no items", () => {
    expect(readiness([], new Map())).toBe(0);
  });
});

describe("activityStreak", () => {
  const now = new Date("2026-11-05T15:00:00Z");
  const d = (s: string) => new Date(`${s}T10:00:00Z`);

  it("counts consecutive days ending today", () => {
    expect(activityStreak([d("2026-11-05"), d("2026-11-04"), d("2026-11-03"), d("2026-11-01")], now)).toBe(3);
  });

  it("still counts when today has no activity yet", () => {
    expect(activityStreak([d("2026-11-04"), d("2026-11-03")], now)).toBe(2);
  });

  it("is 0 after a missed day", () => {
    expect(activityStreak([d("2026-11-02")], now)).toBe(0);
  });
});

describe("hoursByWeek", () => {
  it("buckets hours into Monday-start weeks, oldest first", () => {
    const now = new Date("2026-11-05T12:00:00Z"); // Thursday; week starts Mon 2026-11-02
    const weeks = hoursByWeek(
      [
        { hours: 2, occurredAt: new Date("2026-11-03T09:00:00Z") },
        { hours: 1.5, occurredAt: new Date("2026-11-05T09:00:00Z") },
        { hours: 3, occurredAt: new Date("2026-10-28T09:00:00Z") },
        { hours: null, occurredAt: new Date("2026-11-04T09:00:00Z") },
      ],
      2,
      now,
    );
    expect(weeks).toEqual([
      { weekStart: "2026-10-26", hours: 3 },
      { weekStart: "2026-11-02", hours: 3.5 },
    ]);
  });
});
