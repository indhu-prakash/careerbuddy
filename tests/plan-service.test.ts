import { beforeEach, describe, expect, it, vi } from "vitest";

// Services run against a mocked db and AI layer: no live LLM or database calls.
const tx = vi.hoisted(() => ({
  learningPlan: { updateMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
  portfolioProject: { findMany: vi.fn() },
  planTask: { findFirst: vi.fn(), update: vi.fn(), createMany: vi.fn() },
}));
const db = vi.hoisted(() => ({
  skillEdge: { findMany: vi.fn() },
  userSkill: { findMany: vi.fn() },
  learningResource: { findMany: vi.fn() },
  skillTopic: { findMany: vi.fn() },
  learningPlan: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));
const runAiTask = vi.hoisted(() => vi.fn());
const loadGapContext = vi.hoisted(() => vi.fn());
const recordProgress = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/ai/service", () => ({ runAiTask }));
vi.mock("@/lib/analysis/load", () => ({ loadGapContext }));
vi.mock("@/lib/progress/record", () => ({ recordProgress }));

const { createPlan, PlanInputError } = await import("@/lib/plan/service");
const { updateTask, TaskUpdateError } = await import("@/lib/plan/tasks");
const { pickResource, topicSlice } = await import("@/lib/plan/build");

const USER = "11111111-1111-1111-1111-111111111111";
const id = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;

const item = (n: number, name: string, gap: number, extra: Record<string, unknown> = {}) => ({
  id: `item-${n}`,
  skillId: id(n),
  skillName: name,
  position: n,
  demand: gap,
  have: 0,
  gap,
  status: "missing",
  currentLevel: null,
  requiredLevel: null,
  priority: null,
  category: null,
  effortHours: null,
  fromTemplate: false,
  skill: { id: id(n), slug: name.toLowerCase(), name, category: "framework" },
  ...extra,
});

const ctx = {
  id: "gap-1",
  targetRole: { title: "Frontend Engineer" },
  budget: { hoursPerWeek: 10, weeks: 4 },
  items: [
    item(1, "React", 0.9),
    item(2, "TypeScript", 0.7),
    item(3, "Git", 1, { status: "matched", have: 1, gap: 0 }),
    { ...item(4, "Figma", 0.4), skillId: null, skill: null },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  loadGapContext.mockResolvedValue(ctx);
  db.skillEdge.findMany.mockResolvedValue([
    { fromSkillId: id(5), toSkillId: id(1), from: { name: "JavaScript", category: "language" } },
  ]);
  db.userSkill.findMany.mockResolvedValue([]);
  db.learningResource.findMany.mockResolvedValue([
    { id: "res-1", skillId: id(1), title: "React docs", url: "https://react.dev/learn", kind: "docs", tier: "fundamental" },
  ]);
  db.skillTopic.findMany.mockResolvedValue([
    { skillId: id(1), tier: "fundamental", title: "Components and JSX" },
    { skillId: id(1), tier: "fundamental", title: "Props and state" },
  ]);
  db.learningPlan.findFirst.mockResolvedValue(null);
  db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
  tx.learningPlan.create.mockImplementation(async ({ data }: { data: { weeks: { create: { weekNumber: number }[] } } }) => ({
    id: "plan-1",
    weeks: data.weeks.create.map((w) => ({ id: `week-${w.weekNumber}`, weekNumber: w.weekNumber })),
  }));
  tx.portfolioProject.findMany.mockResolvedValue([]);
});

type CreatedTask = { weekId: string; estHours: number; resourceId: string | null; skillId: string | null; title: string };

/** Weeks as passed to learningPlan.create, with their tasks from planTask.createMany. */
function createdWeeks() {
  const weeks = tx.learningPlan.create.mock.calls[0][0].data.weeks.create as {
    weekNumber: number;
    goal: string;
    content: { textSource: string; resources: { url: string }[]; skills: { name: string }[] };
  }[];
  const tasks = tx.planTask.createMany.mock.calls[0][0].data as CreatedTask[];
  return weeks.map((w) => ({ ...w, tasks: { create: tasks.filter((t) => t.weekId === `week-${w.weekNumber}`) } }));
}

describe("createPlan", () => {
  it("schedules in code, writes all week text in one AI call and saves an active plan", async () => {
    runAiTask.mockImplementation(async () => ({
      data: {
        weeks: [1, 2, 3, 4, 99].map((n) => ({
          weekNumber: n,
          goal: `Goal ${n}`,
          objectives: ["o1"],
          exercises: ["e1"],
          checkpoint: "c",
        })),
      },
    }));

    await createPlan(USER, {});

    expect(runAiTask).toHaveBeenCalledTimes(1);
    expect(runAiTask.mock.calls[0][0]).toMatchObject({ task: "plan.weeks", userId: USER });
    expect(tx.learningPlan.updateMany).toHaveBeenCalledWith({
      where: { userId: USER, status: "active" },
      data: { status: "superseded" },
    });
    const data = tx.learningPlan.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: USER, gapAnalysisId: "gap-1", version: 1, status: "active", durationWeeks: 4 });

    const weeks = createdWeeks();
    expect(weeks.map((w) => w.weekNumber)).toEqual([1, 2, 3, 4]); // week 99 from the AI is ignored
    expect(weeks[0].goal).toBe("Goal 1");
    for (const w of weeks) {
      expect(w.tasks.create.reduce((n, t) => n + t.estHours, 0)).toBeLessThanOrEqual(10);
    }
    const tasks = weeks.flatMap((w) => w.tasks.create);
    // Missing prerequisite pulled in and placed before React.
    const firstJs = tasks.findIndex((t) => t.skillId === id(5));
    const firstReact = tasks.findIndex((t) => t.skillId === id(1));
    expect(firstJs).toBeGreaterThanOrEqual(0);
    expect(firstJs).toBeLessThan(firstReact);
    // Only curated resources are attached; skills without one get none.
    expect(tasks.filter((t) => t.resourceId).every((t) => t.resourceId === "res-1" && t.skillId === id(1))).toBe(true);
    expect(weeks.flatMap((w) => w.content.resources).every((r) => r.url === "https://react.dev/learn")).toBe(true);
    // Matched skills are not planned.
    expect(weeks.flatMap((w) => w.content.skills).some((s) => s.name === "Git")).toBe(false);
  });

  it("falls back to template text when the AI fails, so the plan is still saved", async () => {
    runAiTask.mockRejectedValue(new Error("rate limited"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await createPlan(USER, { weeks: 8, hoursPerWeek: 6 });

    const weeks = createdWeeks();
    expect(weeks).toHaveLength(8);
    expect(weeks.every((w) => w.content.textSource === "template" && w.goal.length > 0)).toBe(true);
    warn.mockRestore();
  });

  it("versions a regenerated plan against the previous one", async () => {
    runAiTask.mockResolvedValue({ data: { weeks: [] } });
    db.learningPlan.findFirst.mockResolvedValueOnce({
      id: "plan-0",
      version: 2,
      durationWeeks: 4,
      hoursPerWeek: 10,
      weeks: [{ content: { skills: [{ key: "x", name: "Vue" }] } }],
    });

    await createPlan(USER, {});

    const data = tx.learningPlan.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ parentId: "plan-0", version: 3, reason: "Regenerated by the user" });
    expect(data.changeSummary.removedSkills).toEqual(["Vue"]);
    expect(data.changeSummary.addedSkills).toContain("React");
  });

  it("returns null for someone else's analysis and refuses when there are no gaps", async () => {
    loadGapContext.mockResolvedValueOnce(null);
    expect(await createPlan(USER, { gapAnalysisId: "x" })).toBeNull();

    loadGapContext.mockResolvedValueOnce({ ...ctx, items: [ctx.items[2]] });
    await expect(createPlan(USER, {})).rejects.toBeInstanceOf(PlanInputError);
    expect(runAiTask).not.toHaveBeenCalled();
  });
});

describe("updateTask", () => {
  const task = {
    id: "task-1",
    kind: "learn",
    status: "todo",
    hoursSpent: 0,
    estHours: 2,
    score: null,
    skillId: id(1),
    completedAt: null,
  };

  it("records completion and counts the estimate as hours when none were logged", async () => {
    tx.planTask.findFirst.mockResolvedValue(task);
    tx.planTask.update.mockImplementation(async ({ data }: { data: object }) => ({ ...task, ...data }));

    await updateTask(USER, "task-1", { status: "done" });

    expect(tx.planTask.findFirst.mock.calls[0][0].where).toEqual({ id: "task-1", userId: USER });
    expect(tx.planTask.update.mock.calls[0][0].data).toMatchObject({ status: "done", hoursSpent: 2 });
    const kinds = recordProgress.mock.calls.map((c) => c[0].kind);
    expect(kinds).toEqual(["hours_logged", "task_completed"]);
    expect(recordProgress.mock.calls[0][0]).toMatchObject({ hours: 2, skillId: id(1), taskId: "task-1" });
  });

  it("records milestones, missed tasks and assessment scores", async () => {
    tx.planTask.update.mockResolvedValue({});
    tx.planTask.findFirst.mockResolvedValueOnce({ ...task, kind: "project_milestone", hoursSpent: 1 });
    await updateTask(USER, "task-1", { status: "done" });
    expect(recordProgress.mock.calls.map((c) => c[0].kind)).toEqual(["task_completed", "project_milestone"]);

    recordProgress.mockClear();
    tx.planTask.findFirst.mockResolvedValueOnce(task);
    await updateTask(USER, "task-1", { status: "missed" });
    expect(recordProgress.mock.calls.map((c) => c[0].kind)).toEqual(["task_missed"]);

    recordProgress.mockClear();
    tx.planTask.findFirst.mockResolvedValueOnce({ ...task, kind: "assessment" });
    await updateTask(USER, "task-1", { score: 0.8 });
    expect(recordProgress.mock.calls[0][0]).toMatchObject({ kind: "assessment_scored", value: 0.8, skillId: id(1) });
  });

  it("rejects scores on non-assessment tasks and returns null for other users' tasks", async () => {
    tx.planTask.findFirst.mockResolvedValueOnce(task);
    await expect(updateTask(USER, "task-1", { score: 0.5 })).rejects.toBeInstanceOf(TaskUpdateError);
    tx.planTask.findFirst.mockResolvedValueOnce(null);
    expect(await updateTask(USER, "task-1", { status: "done" })).toBeNull();
  });
});

describe("plan build helpers", () => {
  const res = (tier: "fundamental" | "intermediate" | "advanced", n = 1) => ({
    id: `${tier}-${n}`,
    skillId: "s",
    title: tier,
    url: `https://x/${tier}/${n}`,
    kind: "docs",
    tier,
  });

  it("picks a curated resource at the tier, else the nearest tier, else none", () => {
    expect(pickResource([res("fundamental"), res("advanced")], "advanced")?.id).toBe("advanced-1");
    expect(pickResource([res("fundamental"), res("advanced")], "intermediate")?.id).toBe("fundamental-1");
    expect(pickResource([res("fundamental", 1), res("fundamental", 2)], "fundamental", 1)?.id).toBe("fundamental-2");
    expect(pickResource([], "fundamental")).toBeNull();
  });

  it("splits topics across task parts", () => {
    expect(topicSlice(["a", "b", "c", "d"], 0, 2)).toEqual(["a", "b"]);
    expect(topicSlice(["a", "b", "c", "d"], 1, 2)).toEqual(["c", "d"]);
    expect(topicSlice(["a"], 2, 3)).toEqual(["a"]);
    expect(topicSlice([], 0, 1)).toEqual([]);
  });
});
