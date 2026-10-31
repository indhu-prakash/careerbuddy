import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked db, plan and projects services: no live LLM or database calls.
const db = vi.hoisted(() => ({
  gapAnalysis: { findFirst: vi.fn() },
  learningPlan: { findFirst: vi.fn() },
  portfolioProject: { count: vi.fn() },
}));
const createPlan = vi.hoisted(() => vi.fn());
const suggestProjects = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/plan/service", () => {
  class PlanInputError extends Error {
    constructor(readonly code: "no_gaps") {
      super(code);
    }
  }
  return { createPlan, PlanInputError };
});
vi.mock("@/lib/projects/service", () => {
  class ProjectInputError extends Error {
    constructor(readonly code: "no_gaps" | "no_valid_ideas") {
      super(code);
    }
  }
  return { suggestProjects, ProjectInputError };
});

const { buildRoadmap, failureCode } = await import("@/lib/roadmap/build");
const { PlanInputError } = await import("@/lib/plan/service");
const { ProjectInputError } = await import("@/lib/projects/service");
const { AiBudgetExceededError } = await import("@/lib/ai/service");
const { AiProviderError } = await import("@/lib/ai/client");

const USER = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  db.gapAnalysis.findFirst.mockResolvedValue({ id: "gap-1" });
  db.learningPlan.findFirst.mockResolvedValue(null);
  db.portfolioProject.count.mockResolvedValue(0);
  createPlan.mockResolvedValue({ id: "plan-1", gapAnalysisId: "gap-1", durationWeeks: 8 });
  suggestProjects.mockResolvedValue({ createdIds: ["p1", "p2", "p3"], planId: "plan-1" });
});

describe("buildRoadmap", () => {
  it("creates the plan, then suggests projects into it", async () => {
    const { steps } = await buildRoadmap(USER);
    expect(steps).toEqual([
      { step: "plan", outcome: "ran", detail: { planId: "plan-1", weeks: 8 } },
      { step: "projects", outcome: "ran", detail: { projects: 3, planId: "plan-1" } },
    ]);
    expect(createPlan).toHaveBeenCalledWith(USER, { gapAnalysisId: "gap-1" });
    expect(suggestProjects).toHaveBeenCalledWith(USER, { planId: "plan-1" });
    expect(db.portfolioProject.count).toHaveBeenCalledWith({
      where: { userId: USER, gapAnalysisId: "gap-1", status: { not: "dropped" } },
    });
    // Every query is scoped to the user.
    expect(db.gapAnalysis.findFirst.mock.calls[0][0].where).toEqual({ userId: USER });
    expect(db.learningPlan.findFirst.mock.calls[0][0].where).toEqual({ userId: USER, status: "active" });
  });

  it("skips both steps when already done", async () => {
    db.learningPlan.findFirst.mockResolvedValue({ id: "plan-0", gapAnalysisId: "gap-0" });
    db.portfolioProject.count.mockResolvedValue(2);
    const { steps } = await buildRoadmap(USER);
    expect(steps).toEqual([
      { step: "plan", outcome: "skipped", reason: "already_done" },
      { step: "projects", outcome: "skipped", reason: "already_done" },
    ]);
    expect(createPlan).not.toHaveBeenCalled();
    expect(suggestProjects).not.toHaveBeenCalled();
    // Projects are checked against the active plan's analysis, not the latest one.
    expect(db.portfolioProject.count.mock.calls[0][0].where.gapAnalysisId).toBe("gap-0");
  });

  it("existing plan but no projects: only suggests projects", async () => {
    db.learningPlan.findFirst.mockResolvedValue({ id: "plan-0", gapAnalysisId: "gap-0" });
    const { steps } = await buildRoadmap(USER);
    expect(steps.map((s) => [s.step, s.outcome])).toEqual([
      ["plan", "skipped"],
      ["projects", "ran"],
    ]);
    expect(createPlan).not.toHaveBeenCalled();
    expect(suggestProjects).toHaveBeenCalledWith(USER, { planId: "plan-0" });
  });

  it("without a gap analysis nothing is automated", async () => {
    db.gapAnalysis.findFirst.mockResolvedValue(null);
    const { steps } = await buildRoadmap(USER);
    expect(steps).toEqual([
      { step: "plan", outcome: "skipped", reason: "needs_gap_map" },
      { step: "projects", outcome: "skipped", reason: "needs_gap_map" },
    ]);
    expect(createPlan).not.toHaveBeenCalled();
    expect(suggestProjects).not.toHaveBeenCalled();
  });

  it("keeps the plan result when project suggestion hits the AI limit", async () => {
    suggestProjects.mockRejectedValue(new AiBudgetExceededError(50, new Date()));
    const { steps } = await buildRoadmap(USER);
    expect(steps).toEqual([
      { step: "plan", outcome: "ran", detail: { planId: "plan-1", weeks: 8 } },
      { step: "projects", outcome: "failed", reason: "ai_daily_limit" },
    ]);
  });

  it("a failed plan step still suggests projects for the latest analysis", async () => {
    createPlan.mockRejectedValue(new PlanInputError("no_gaps"));
    suggestProjects.mockResolvedValue({ createdIds: ["p1", "p2"], planId: null });
    const { steps } = await buildRoadmap(USER);
    expect(steps).toEqual([
      { step: "plan", outcome: "failed", reason: "no_gaps" },
      { step: "projects", outcome: "ran", detail: { projects: 2, planId: undefined } },
    ]);
    expect(suggestProjects).toHaveBeenCalledWith(USER, { gapAnalysisId: "gap-1" });
  });

  it("reports null results and unexpected errors as failures", async () => {
    createPlan.mockResolvedValue(null);
    suggestProjects.mockRejectedValue(new Error("boom"));
    const { steps } = await buildRoadmap(USER);
    expect(steps).toEqual([
      { step: "plan", outcome: "failed", reason: "no_analysis" },
      { step: "projects", outcome: "failed", reason: "failed" },
    ]);
  });
});

describe("failureCode", () => {
  it("maps known errors to API codes", () => {
    expect(failureCode(new AiBudgetExceededError(1, new Date()))).toBe("ai_daily_limit");
    expect(failureCode(new AiProviderError([{ model: "m", kind: "rate_limited", message: "x" }]))).toBe("ai_busy");
    expect(failureCode(new ProjectInputError("no_valid_ideas"))).toBe("no_valid_ideas");
    expect(failureCode(new PlanInputError("no_gaps"))).toBe("no_gaps");
    expect(failureCode(new Error("x"))).toBe("failed");
  });
});
