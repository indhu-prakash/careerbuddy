import { describe, expect, it } from "vitest";
import { selectProjects } from "@/lib/scoring/coverage";

const weights = new Map([
  ["a", 5],
  ["b", 4],
  ["c", 3],
  ["d", 2],
  ["e", 1],
]);

describe("selectProjects", () => {
  it("greedily picks the candidate covering the most uncovered weight", () => {
    const r = selectProjects(
      [
        { key: "p1", skills: ["a", "b"] }, // 9
        { key: "p2", skills: ["a", "c"] }, // 8, then 3 after p1
        { key: "p3", skills: ["c", "d", "e"] }, // 6
        { key: "p4", skills: ["b", "e"] },
      ],
      weights,
      { top: ["a", "b", "c", "d", "e"] },
    );
    expect(r.chosen).toEqual(["p1", "p3"]);
    expect(r.uncoveredTop).toEqual([]);
    expect(r.coveredBy).toEqual({ a: ["p1"], b: ["p1"], c: ["p3"], d: ["p3"], e: ["p3"] });
  });

  it("stops at max and reports uncovered top gaps", () => {
    const r = selectProjects(
      [
        { key: "p1", skills: ["a", "x"] },
        { key: "p2", skills: ["b", "y"] },
        { key: "p3", skills: ["c", "d"] },
      ],
      weights,
      { max: 2, minGapSkills: 1, top: ["a", "b", "c"] },
    );
    expect(r.chosen).toEqual(["p1", "p3"]);
    expect(r.uncoveredTop).toEqual(["b"]);
  });

  it("drops candidates with fewer than 2 gap skills and ignores unknown tags", () => {
    const r = selectProjects(
      [
        { key: "solo", skills: ["a", "unknown"] },
        { key: "p1", skills: ["b", "c"] },
        { key: "p2", skills: ["d", "e"] },
      ],
      weights,
    );
    expect(r.chosen).not.toContain("solo");
    expect(r.chosen).toEqual(["p1", "p2"]);
  });

  it("reaches the minimum with reinforcement picks when coverage is exhausted", () => {
    const r = selectProjects(
      [
        { key: "p1", skills: ["a", "b"] },
        { key: "p2", skills: ["a", "b"] },
      ],
      new Map([
        ["a", 1],
        ["b", 1],
      ]),
      { top: ["a", "b"] },
    );
    expect(r.chosen).toEqual(["p1", "p2"]);
  });

  it("falls back to weaker candidates when too few have 2 gap skills", () => {
    const r = selectProjects(
      [
        { key: "p1", skills: ["a"] },
        { key: "p2", skills: ["b"] },
        { key: "none", skills: ["z"] },
      ],
      weights,
    );
    expect(r.chosen).toEqual(["p1", "p2"]);
  });

  it("returns nothing for no candidates", () => {
    expect(selectProjects([], weights).chosen).toEqual([]);
  });
});
