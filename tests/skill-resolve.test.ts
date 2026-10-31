import { describe, expect, it } from "vitest";
import { buildSkillIndex, lookupSkill, slugifySkill, type CatalogSkill } from "@/lib/skills/resolve";

const catalog: CatalogSkill[] = [
  { id: "1", slug: "csharp", name: "C#", aliases: ["c sharp", "csharp", ".net"] },
  { id: "2", slug: "nextjs", name: "Next.js", aliases: ["nextjs", "next js"] },
  { id: "3", slug: "kubernetes", name: "Kubernetes", aliases: ["k8s"] },
  { id: "4", slug: "c", name: "C", aliases: [] },
];

describe("slugifySkill", () => {
  it("matches the seed's slug style", () => {
    expect(slugifySkill("C#")).toBe("csharp");
    expect(slugifySkill("Next.js")).toBe("nextjs");
    expect(slugifySkill("CI/CD")).toBe("ci-cd");
    expect(slugifySkill("C++")).toBe("cplusplus");
    expect(slugifySkill("  Retrieval-Augmented Generation ")).toBe("retrieval-augmented-generation");
  });
});

describe("lookupSkill", () => {
  const index = buildSkillIndex(catalog);

  it("resolves canonical names, aliases and slugs case-insensitively", () => {
    expect(lookupSkill(index, "c#")?.id).toBe("1");
    expect(lookupSkill(index, "K8s")?.id).toBe("3");
    expect(lookupSkill(index, "NEXT JS")?.id).toBe("2");
    expect(lookupSkill(index, "next.js")?.id).toBe("2");
  });

  it("keeps distinct skills that differ only by punctuation", () => {
    expect(lookupSkill(index, "C")?.id).toBe("4");
    expect(lookupSkill(index, "C#")?.id).toBe("1");
  });

  it("returns undefined for unknown skills", () => {
    expect(lookupSkill(index, "Terraform")).toBeUndefined();
  });
});
