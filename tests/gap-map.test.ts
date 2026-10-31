import { describe, expect, it } from "vitest";
import { gapRecommendations, scoreGapMap, templateWeight, type Requirement } from "@/lib/scoring/gap-map";

const req = (key: string, required = true, extra: Partial<Requirement> = {}): Requirement => ({
  key,
  skillId: key,
  name: key,
  required,
  requiredLevel: null,
  domain: false,
  quote: null,
  ...extra,
});

describe("scoreGapMap", () => {
  it("matches the same catalog skill even if each side spelled it differently", () => {
    // Both sides were resolved to skill id "kubernetes" before scoring ("k8s" vs "Kubernetes").
    const { items, matchScore } = scoreGapMap({
      jds: [[req("kubernetes", true, { name: "k8s", requiredLevel: 2 })]],
      held: [{ key: "kubernetes", level: 2, quote: "Ran Kubernetes clusters" }],
    });
    expect(items[0]).toMatchObject({ status: "matched", have: 1, evidence: "Ran Kubernetes clusters" });
    expect(matchScore).toBe(1);
  });

  it("weights demand by JD frequency and required vs nice-to-have", () => {
    const { items } = scoreGapMap({
      jds: [[req("python"), req("aws", false)], [req("python"), req("sql")]],
      held: [],
    });
    const by = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(by.python.demand).toBe(1);
    expect(by.sql.demand).toBe(0.5);
    expect(by.aws.demand).toBe(0.25);
    expect(by.python.category).toBe("must_have");
    expect(by.aws.category).toBe("good_to_have");
  });

  it("gives partial credit below the required level and uses the median level hint", () => {
    const { items } = scoreGapMap({
      jds: [[req("react", true, { requiredLevel: 3 })], [req("react", true, { requiredLevel: 4 })], [req("react", true, { requiredLevel: 3 })]],
      held: [{ key: "react", level: 2, quote: null }],
    });
    expect(items[0]).toMatchObject({ requiredLevel: 3, have: 0.5, status: "partial", effortHours: 10 });
  });

  it("blends in the role template with fewer than 3 JDs", () => {
    expect(templateWeight(1, true)).toBeCloseTo(2 / 3);
    expect(templateWeight(3, true)).toBe(0);
    const { items } = scoreGapMap({
      jds: [[req("react")]],
      template: [
        { key: "react", skillId: "react", name: "React", requiredLevel: 2, importance: "core", choiceGroup: null },
        { key: "git", skillId: "git", name: "Git", requiredLevel: 2, importance: "core", choiceGroup: null },
      ],
      held: [],
    });
    const git = items.find((i) => i.key === "git")!;
    expect(git.fromTemplate).toBe(true);
    expect(git.category).toBe("must_have");
    expect(git.demand).toBeCloseTo(2 / 3, 2);
  });

  it("never ranks a template-only skill above a skill the JD requires", () => {
    const { items } = scoreGapMap({
      jds: [[req("postgres")]],
      template: [{ key: "git", skillId: "git", name: "Git", requiredLevel: 2, importance: "core", choiceGroup: null }],
      held: [],
    });
    const by = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(by.postgres.demand).toBe(1);
    expect(by.git.demand).toBeLessThan(by.postgres.demand);
    expect(items[0].key).toBe("postgres");
  });

  it("ignores the template once there are 3 or more JDs", () => {
    const { items } = scoreGapMap({
      jds: [[req("react")], [req("react")], [req("react")]],
      template: [{ key: "git", skillId: "git", name: "Git", requiredLevel: 2, importance: "core", choiceGroup: null }],
      held: [],
    });
    expect(items.map((i) => i.key)).toEqual(["react"]);
  });

  it("counts a template choice group once, using the alternative the user knows", () => {
    const { items } = scoreGapMap({
      jds: [],
      template: [
        { key: "react", skillId: "react", name: "React", requiredLevel: 2, importance: "core", choiceGroup: "ui" },
        { key: "vue", skillId: "vue", name: "Vue", requiredLevel: 2, importance: "core", choiceGroup: "ui" },
      ],
      held: [{ key: "vue", level: 3, quote: null }],
    });
    expect(items.map((i) => i.key)).toEqual(["vue"]);
    expect(items[0].status).toBe("matched");
  });

  it("discounts effort when a related skill is already known, and ranks by priority", () => {
    const { items } = scoreGapMap({
      jds: [[req("java", true, { requiredLevel: 3 }), req("go", true, { requiredLevel: 3 })]],
      held: [{ key: "csharp", level: 3, quote: null }],
      related: new Map([["java", ["csharp"]]]),
      names: new Map([["csharp", "C#"]]),
    });
    const java = items.find((i) => i.key === "java")!;
    const go = items.find((i) => i.key === "go")!;
    expect(java.effortHours).toBe(21);
    expect(go.effortHours).toBe(30);
    expect(java.transferableFrom).toEqual(["C#"]);
    expect(java.priority).toBeGreaterThan(go.priority);
  });

  it("returns zeros for no input", () => {
    expect(scoreGapMap({ jds: [], held: [] })).toEqual({ matchScore: 0, items: [], templateWeight: 0 });
  });
});

describe("gapRecommendations", () => {
  it("describes the top gaps with level, effort and evidence of demand", () => {
    const { items } = scoreGapMap({ jds: [[req("docker", true, { name: "Docker", requiredLevel: 2 })]], held: [] });
    expect(gapRecommendations(items, { jdCount: 1 })).toEqual([
      "Build Docker to intermediate (you're at none): about 20 h, asked for in 1 of 1 job description.",
    ]);
  });
});
