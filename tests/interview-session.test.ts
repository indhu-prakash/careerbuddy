import { describe, expect, it } from "vitest";
import {
  followUpText,
  MAX_FOLLOW_UPS,
  orderQuestions,
  pickFocusSkills,
  planSlots,
  shouldFollowUp,
  type FocusSkill,
} from "@/lib/interview/plan";
import { buildSessionReport, type ScoredQuestion } from "@/lib/scoring/interview";

const item = (skillName: string, status: FocusSkill["status"], gap: number, priority: number | null = null) => ({
  skillId: `id-${skillName}`,
  skillName,
  status,
  gap,
  demand: gap,
  priority,
});

describe("pickFocusSkills", () => {
  it("keeps unmatched gaps, highest priority first, falling back to gap size", () => {
    const skills = pickFocusSkills([
      item("SQL", "matched", 0),
      item("Kafka", "missing", 0.4),
      item("Spark", "partial", 0.6),
      item("Airflow", "missing", 0.2, 0.9),
    ]);
    expect(skills.map((s) => s.skillName)).toEqual(["Airflow", "Spark", "Kafka"]);
  });

  it("uses the most in-demand skills when nothing is missing", () => {
    const skills = pickFocusSkills([item("SQL", "matched", 0.3), item("Python", "matched", 0.8)]);
    expect(skills.map((s) => s.skillName)).toEqual(["Python", "SQL"]);
  });
});

describe("planSlots", () => {
  const skills: FocusSkill[] = [
    { skillId: "a", skillName: "Kafka", status: "missing" },
    { skillId: "b", skillName: "Spark", status: "partial" },
  ];

  it("cycles the kind's types and spreads gaps over non-behavioral slots", () => {
    const slots = planSlots("mixed", 5, skills);
    expect(slots.map((s) => s.type)).toEqual(["technical", "behavioral", "system_design", "scenario", "coding"]);
    expect(slots.map((s) => s.skill)).toEqual(["Kafka", null, "Spark", "Kafka", "Spark"]);
    expect(slots[0]).toMatchObject({ slot: 1, skillId: "a", gap: "missing" });
  });

  it("clamps the count and works without gaps", () => {
    expect(planSlots("technical", 50, [])).toHaveLength(8);
    const slots = planSlots("behavioral", 1, skills);
    expect(slots).toHaveLength(3);
    expect(slots.every((s) => s.type === "behavioral" && s.skillId === null)).toBe(true);
  });
});

describe("orderQuestions", () => {
  it("puts follow-ups directly after their parent", () => {
    const ordered = orderQuestions([
      { id: "q1", parentId: null, seq: 1 },
      { id: "q2", parentId: null, seq: 2 },
      { id: "f1", parentId: "q1", seq: 3 },
      { id: "q3", parentId: null, seq: 4 },
    ]);
    expect(ordered.map((q) => q.id)).toEqual(["q1", "f1", "q2", "q3"]);
  });
});

describe("shouldFollowUp", () => {
  const weak = [{ score: 4 }, { score: 2 }];
  it("triggers when a criterion scores 2 or lower", () => {
    expect(shouldFollowUp({ parentId: null, criteria: weak, followUpsSoFar: 0 })).toBe(true);
    expect(shouldFollowUp({ parentId: null, criteria: [{ score: 3 }, { score: 5 }], followUpsSoFar: 0 })).toBe(false);
  });
  it("never follows up on a follow-up, and respects the session cap", () => {
    expect(shouldFollowUp({ parentId: "q1", criteria: weak, followUpsSoFar: 0 })).toBe(false);
    expect(shouldFollowUp({ parentId: null, criteria: weak, followUpsSoFar: MAX_FOLLOW_UPS })).toBe(false);
  });
});

describe("followUpText", () => {
  it("uses the model's wording, or probes the weakest criterion", () => {
    expect(followUpText("  How would you handle retries?  ", [])).toBe("How would you handle retries?");
    const text = followUpText("", [
      { criterion: "Depth", score: 3 },
      { criterion: "Trade-offs", score: 1 },
    ]);
    expect(text).toContain("trade-offs");
  });
});

describe("buildSessionReport", () => {
  const answer = (overrides: Partial<ScoredQuestion>): ScoredQuestion => ({
    skillId: null,
    skillName: null,
    overallScore: 50,
    criteria: [],
    missingConcepts: [],
    ...overrides,
  });

  it("computes the session score and per-skill means", () => {
    const report = buildSessionReport([
      answer({ skillId: "k", skillName: "Kafka", overallScore: 40 }),
      answer({ skillId: "k", skillName: "Kafka", overallScore: 60 }),
      answer({ skillId: "s", skillName: "Spark", overallScore: 90 }),
      answer({ overallScore: 75 }),
    ]);
    expect(report.sessionScore).toBe(66); // (40+60+90+75)/4 = 66.25
    expect(report.answered).toBe(4);
    expect(report.skills).toEqual([
      { skillId: "k", skillName: "Kafka", mean: 50, count: 2 },
      { skillId: "s", skillName: "Spark", mean: 90, count: 1 },
    ]);
  });

  it("flags criteria that score ≤ 2 in at least two answers as recurring", () => {
    const report = buildSessionReport([
      answer({ criteria: [{ criterion: "Communication", score: 2 }, { criterion: "Depth", score: 1 }] }),
      answer({ criteria: [{ criterion: "communication", score: 1 }, { criterion: "Depth", score: 4 }] }),
      answer({ criteria: [{ criterion: "Communication", score: 4 }] }),
    ]);
    expect(report.recurringWeaknesses).toEqual([{ criterion: "Communication", mean: 2.3, count: 3 }]);
    expect(report.criteria.map((c) => c.criterion)).toEqual(["Communication", "Depth"]);
  });

  it("counts missing concepts once per answer, most frequent first", () => {
    const report = buildSessionReport([
      answer({ missingConcepts: ["Idempotency", "idempotency ", "Backpressure"] }),
      answer({ missingConcepts: ["idempotency", ""] }),
    ]);
    expect(report.missingConcepts).toEqual([
      { concept: "Idempotency", count: 2 },
      { concept: "Backpressure", count: 1 },
    ]);
  });

  it("has no score when nothing was answered", () => {
    expect(buildSessionReport([]).sessionScore).toBeNull();
  });
});
