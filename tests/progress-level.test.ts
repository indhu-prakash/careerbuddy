import { describe, expect, it } from "vitest";
import { computeSkillLevel, ratingToLevel, scoreToLevel } from "@/lib/scoring/progress";

const now = new Date("2026-11-01T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe("computeSkillLevel", () => {
  it("returns null without evidence", () => {
    expect(computeSkillLevel([], now)).toBeNull();
  });

  it("weights assessed evidence above self-reports", () => {
    const r = computeSkillLevel(
      [
        { kind: "self_reported", level: 4, at: daysAgo(1) },
        { kind: "assessed", level: 1, at: daysAgo(1) },
      ],
      now,
    );
    expect(r).toEqual({ level: 2, evidenceType: "assessed" }); // (4*1 + 1*3) / 4 = 1.75
  });

  it("one strong score doesn't jump a demonstrated skill straight to expert", () => {
    const r = computeSkillLevel(
      [
        { kind: "demonstrated", level: 2, at: daysAgo(10) },
        { kind: "demonstrated", level: 2, at: daysAgo(10) },
        { kind: "assessed", level: 4, at: daysAgo(0) },
      ],
      now,
    );
    expect(r!.level).toBe(3);
  });

  it("caps unproven skills at intermediate", () => {
    expect(computeSkillLevel([{ kind: "self_reported", level: 4, at: daysAgo(0) }], now)).toEqual({
      level: 2,
      evidenceType: "self_reported",
    });
  });

  it("lets newer evidence outweigh old evidence of the same kind", () => {
    const r = computeSkillLevel(
      [
        { kind: "assessed", level: 0, at: daysAgo(240) },
        { kind: "assessed", level: 4, at: daysAgo(0) },
      ],
      now,
    );
    expect(r!.level).toBe(4);
  });
});

describe("score conversions", () => {
  it("maps scores and ratings onto levels 0-4", () => {
    expect(scoreToLevel(0)).toBe(0);
    expect(scoreToLevel(0.74)).toBe(3);
    expect(scoreToLevel(1.5)).toBe(4);
    expect(ratingToLevel(1)).toBe(0);
    expect(ratingToLevel(5)).toBe(4);
  });
});
