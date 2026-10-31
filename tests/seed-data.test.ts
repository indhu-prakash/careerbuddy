import { describe, expect, it } from "vitest";
import { checkCatalog, loadCatalog, type Catalog } from "../prisma/seed/catalog";
import { normalizeSkillTerm } from "@/lib/skills/normalize";

describe("seed catalog", () => {
  const catalog = loadCatalog();

  it("passes schema and integrity checks", () => {
    expect(checkCatalog(catalog)).toEqual([]);
  });

  it("covers every tier for every role and gives each skill a resource", () => {
    for (const r of catalog.roles) {
      expect(r.skills.fundamental.length + r.skills.intermediate.length + r.skills.advanced.length).toBeGreaterThanOrEqual(10);
    }
    for (const s of catalog.skills) expect(s.resources.length).toBeGreaterThan(0);
  });

  it("uses every skill in at least one role", () => {
    const used = new Set(catalog.roles.flatMap((r) => [...r.skills.fundamental, ...r.skills.intermediate, ...r.skills.advanced].map((x) => x.skill)));
    expect(catalog.skills.map((s) => s.slug).filter((s) => !used.has(s))).toEqual([]);
  });

  it("maps common aliases to one canonical skill", () => {
    const owner = new Map<string, string>();
    for (const s of catalog.skills) for (const t of [s.name, ...s.aliases]) owner.set(normalizeSkillTerm(t), s.slug);
    expect(owner.get("k8s")).toBe("kubernetes");
    expect(owner.get("js")).toBe("javascript");
    expect(owner.get("c#")).toBe("csharp");
    expect(owner.get("postgres")).toBe("postgresql");
  });
});

describe("checkCatalog", () => {
  const skill = (slug: string, prerequisites: string[] = [], aliases: string[] = []) => ({
    slug, name: slug.toUpperCase(), category: "concept" as const, aliases, description: "test skill description",
    prerequisites, related: [],
    topics: { fundamental: ["aaa", "bbb"], intermediate: ["ccc", "ddd"], advanced: ["eee", "fff"] },
    resources: [{ title: "Docs", url: "https://example.com", kind: "docs" as const, tier: "fundamental" as const }],
  });

  it("detects prerequisite cycles, unknown references and alias clashes", () => {
    const bad: Catalog = {
      skills: [skill("a", ["b"], ["shared"]), skill("b", ["a"], ["shared"]), skill("c", ["missing"])],
      roles: [],
    };
    const problems = checkCatalog(bad).join("\n");
    expect(problems).toMatch(/prerequisite cycle/);
    expect(problems).toMatch(/unknown skill "missing"/);
    expect(problems).toMatch(/term "shared" used by both/);
  });
});
