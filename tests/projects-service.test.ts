import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked db and AI layer: no live LLM or database calls.
const tx = vi.hoisted(() => ({
  portfolioProject: { findMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  planTask: { deleteMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  learningPlan: { findFirstOrThrow: vi.fn() },
}));
const db = vi.hoisted(() => ({
  learningPlan: { findFirst: vi.fn() },
  skill: { findMany: vi.fn() },
  portfolioProject: { findMany: vi.fn(), findFirst: vi.fn() },
  $transaction: vi.fn(),
}));
const runAiTask = vi.hoisted(() => vi.fn());
const loadGapContext = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/ai/service", () => ({ runAiTask }));
vi.mock("@/lib/analysis/load", () => ({ loadGapContext }));

const { suggestProjects, updateProject } = await import("@/lib/projects/service");

const USER = "11111111-1111-1111-1111-111111111111";
const SKILLS = ["React", "TypeScript", "Docker", "PostgreSQL", "AWS", "GraphQL"];
const sid = (name: string) => `skill-${name.toLowerCase()}`;

const ctx = {
  id: "gap-1",
  targetRole: { title: "Full-stack Engineer" },
  budget: { hoursPerWeek: 10, weeks: 4 },
  items: SKILLS.map((name, i) => ({
    skillId: sid(name),
    skillName: name,
    demand: 1 - i * 0.1,
    have: 0,
    gap: 1 - i * 0.1,
    status: "missing",
    currentLevel: null,
    requiredLevel: null,
    priority: null,
    category: null,
    effortHours: null,
    skill: { id: sid(name), slug: name.toLowerCase(), name, category: "framework" },
  })),
};

const idea = (title: string, skills: string[], tier = "intermediate") => ({
  title,
  tier,
  problem: `${title} problem`,
  skills,
  scope: "scope",
  milestones: [
    { title: "Setup", deliverable: "repo" },
    { title: "Ship", deliverable: "demo" },
  ],
  architecture: "arch",
  testing: "tests",
  deployment: "deploy",
  deliverables: ["README"],
  talkingPoints: { situation: "s", task: "t", action: "a", result: "r" },
});

beforeEach(() => {
  vi.clearAllMocks();
  loadGapContext.mockResolvedValue(ctx);
  db.learningPlan.findFirst.mockResolvedValue({ id: "plan-1", gapAnalysisId: "gap-1", durationWeeks: 4, hoursPerWeek: 10 });
  db.skill.findMany.mockResolvedValue(
    [...SKILLS, "Kubernetes"].map((name) => ({ id: sid(name), slug: name.toLowerCase(), name, aliases: [] })),
  );
  db.portfolioProject.findMany.mockResolvedValue([]);
  db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
  tx.portfolioProject.findMany.mockResolvedValue([]);
  let n = 0;
  tx.portfolioProject.create.mockImplementation(async ({ data }: { data: { title: string } }) => ({
    id: `proj-${++n}`,
    title: data.title,
  }));
  let t = 0;
  tx.planTask.create.mockImplementation(async () => ({ id: `task-${++t}` }));
  tx.learningPlan.findFirstOrThrow.mockResolvedValue({
    hoursPerWeek: 10,
    weeks: [1, 2, 3, 4].map((w) => ({
      id: `week-${w}`,
      weekNumber: w,
      startDate: new Date("2026-11-02"),
      tasks: [{ estHours: 6, skillId: w === 1 ? sid("React") : sid("Docker"), position: 0, kind: "learn" }],
    })),
  });
});

describe("suggestProjects", () => {
  it("validates tags, selects by set cover and fits milestones into the plan", async () => {
    runAiTask.mockResolvedValue({
      data: {
        projects: [
          idea("Storefront", ["React", "TypeScript", "Made Up Tool"]),
          idea("Infra", ["Docker", "AWS", "Kubernetes"]),
          idea("API", ["PostgreSQL", "GraphQL", "TypeScript"]),
          idea("Solo", ["React"]),
        ],
      },
    });

    const result = await suggestProjects(USER, {});

    expect(runAiTask).toHaveBeenCalledTimes(1);
    expect(runAiTask.mock.calls[0][0]).toMatchObject({ task: "projects.ideas", userId: USER });
    const created = tx.portfolioProject.create.mock.calls.map((c) => c[0].data);
    expect(created.length).toBeGreaterThanOrEqual(2);
    expect(created.length).toBeLessThanOrEqual(4);
    expect(created.map((p) => p.title)).not.toContain("Solo");
    const storefront = created.find((p) => p.title === "Storefront")!;
    expect(storefront.skills).toEqual(["React", "TypeScript"]); // unknown tag dropped
    expect(storefront).toMatchObject({ userId: USER, gapAnalysisId: "gap-1", planId: "plan-1" });
    // Catalog skill that's not a gap is kept as a tag but doesn't count toward coverage.
    const infra = created.find((p) => p.title === "Infra")!;
    expect(infra.skills).toContain("Kubernetes");
    expect(infra.spec.skillKeys).not.toContain(sid("Kubernetes"));

    // Milestones become project_milestone tasks without exceeding 8.5 h/week (10 h minus 15%).
    const tasks = tx.planTask.create.mock.calls.map((c) => c[0].data);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.kind === "project_milestone" && t.userId === USER)).toBe(true);
    const perWeek = new Map<string, number>();
    for (const t of tasks) perWeek.set(t.weekId, (perWeek.get(t.weekId) ?? 0) + t.estHours);
    for (const h of perWeek.values()) expect(6 + h).toBeLessThanOrEqual(8.5);
    // Spec records where each milestone went.
    const update = tx.portfolioProject.update.mock.calls[0][0].data;
    expect(update.planId).toBe("plan-1");
    expect(update.spec.milestones.some((m: { taskIds: string[] }) => m.taskIds.length > 0)).toBe(true);
    expect(result).toMatchObject({ planId: "plan-1" });
  });

  it("returns null for a plan that isn't the user's", async () => {
    db.learningPlan.findFirst.mockResolvedValueOnce(null);
    expect(await suggestProjects(USER, { planId: "someone-elses" })).toBeNull();
    expect(runAiTask).not.toHaveBeenCalled();
  });
});

describe("updateProject", () => {
  it("skips open milestone tasks when a project is dropped", async () => {
    db.portfolioProject.findFirst.mockResolvedValue({
      id: "proj-1",
      spec: {
        scope: "",
        architecture: "",
        testing: "",
        deployment: "",
        deliverables: [],
        milestones: [{ title: "m", deliverable: "d", estHours: 2, taskIds: ["task-9"], weekNumber: 2 }],
        skillKeys: [],
        promptVersion: "x",
      },
    });
    tx.portfolioProject.update.mockResolvedValue({ id: "proj-1", spec: null });

    await updateProject(USER, "proj-1", { status: "dropped" });

    expect(db.portfolioProject.findFirst.mock.calls[0][0].where).toEqual({ id: "proj-1", userId: USER });
    expect(tx.planTask.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: { in: ["task-9"] }, userId: USER },
      data: { status: "skipped" },
    });
  });
});
