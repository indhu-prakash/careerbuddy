import { describe, expect, it } from "vitest";
import { scoreGaps } from "@/lib/scoring/gap";

describe("scoreGaps", () => {
  it("weights by JD frequency and required/nice-to-have", () => {
    const jds = [
      [{ skill: "Python", required: true }, { skill: "Kubernetes", required: false }],
      [{ skill: "Python", required: true }, { skill: "SQL", required: true }],
    ];
    const resume = [
      { skill: "python", have: 1 as const },
      { skill: "SQL", have: 0.5 as const },
    ];

    const { matchScore, items } = scoreGaps(jds, resume);

    const byName = Object.fromEntries(items.map((i) => [i.skill.toLowerCase(), i]));
    expect(byName.python.demand).toBe(1);
    expect(byName.sql.demand).toBe(0.5);
    expect(byName.kubernetes.demand).toBe(0.25);
    expect(byName.kubernetes.status).toBe("missing");
    expect(byName.sql.status).toBe("partial");
    // (1*1 + 0.5*0.5 + 0.25*0) / (1 + 0.5 + 0.25)
    expect(matchScore).toBeCloseTo(1.25 / 1.75);
    // SQL and Kubernetes tie on gap (0.25); higher demand wins the tie.
    expect(items.map((i) => i.skill)).toEqual(["SQL", "Kubernetes", "Python"]);
  });

  it("returns zero for no JDs", () => {
    expect(scoreGaps([], [])).toEqual({ matchScore: 0, items: [] });
  });
});
