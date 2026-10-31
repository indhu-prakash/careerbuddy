import { describe, expect, it } from "vitest";
import { cleanRoleTitle, matchRoleTrack, type CatalogRole } from "@/lib/skills/roles";

const tracks: CatalogRole[] = [
  { id: "fs", slug: "full-stack-engineer", title: "Full-Stack Engineer", aliases: ["fullstack engineer", "full stack developer"] },
  { id: "ai", slug: "ai-engineer", title: "AI Engineer", aliases: ["llm engineer", "genai engineer"] },
  { id: "be", slug: "backend-engineer", title: "Backend Engineer", aliases: ["back-end developer"] },
];

describe("cleanRoleTitle", () => {
  it("drops a trailing company the model folded into the title", () => {
    expect(cleanRoleTitle("Full Stack Engineer at Globex", "Globex")).toBe("Full Stack Engineer");
    expect(cleanRoleTitle("AI Engineer - Acme Corp.", "Acme Corp.")).toBe("AI Engineer");
    expect(cleanRoleTitle("Backend Engineer (Remote)", null)).toBe("Backend Engineer");
  });

  it("leaves titles without a company alone", () => {
    expect(cleanRoleTitle("Data Engineer", "Globex")).toBe("Data Engineer");
  });
});

describe("matchRoleTrack", () => {
  it("ignores spacing, hyphens and seniority", () => {
    expect(matchRoleTrack("Full Stack Engineer", tracks)?.id).toBe("fs");
    expect(matchRoleTrack("Senior Full-Stack Engineer", tracks)?.id).toBe("fs");
    expect(matchRoleTrack("Sr. Back-End Developer", tracks)?.id).toBe("be");
    expect(matchRoleTrack("LLM Engineer II", tracks)?.id).toBe("ai");
  });

  it("returns undefined for roles not in the taxonomy", () => {
    expect(matchRoleTrack("Marketing Manager", tracks)).toBeUndefined();
    expect(matchRoleTrack("Senior", tracks)).toBeUndefined();
  });
});
