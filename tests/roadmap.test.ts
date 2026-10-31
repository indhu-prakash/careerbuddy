import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  computeStages,
  nextBestAction,
  profileComplete,
  type RoadmapFacts,
  type StageKey,
  type TimelineWeekInput,
} from "@/lib/scoring/roadmap";

const fullProfile: RoadmapFacts["profile"] = {
  hasResume: true,
  skills: 12,
  reviewedSkills: 12,
  targetRole: "Data Engineer",
  hoursPerWeek: 8,
  onboarded: true,
};

function facts(over: Partial<RoadmapFacts> = {}): RoadmapFacts {
  return {
    profile: fullProfile,
    analysis: { id: "gap-1", matchScore: 0.62, targetRole: "Data Engineer" },
    plan: { id: "plan-1", currentWeek: 3, durationWeeks: 8, tasksDone: 14, tasksTotal: 30 },
    projects: { suggested: 1, inProgress: 1, done: 0 },
    interviews: { completed: 0, avgScore: null },
    applications: { total: 0, responses: 0, offers: 0 },
    readiness: 0.5,
    ...over,
  };
}

const empty = facts({
  profile: { hasResume: false, skills: 0, reviewedSkills: 0, targetRole: null, hoursPerWeek: null, onboarded: false },
  analysis: null,
  plan: null,
  projects: { suggested: 0, inProgress: 0, done: 0 },
  readiness: null,
});

const status = (f: RoadmapFacts) =>
  Object.fromEntries(computeStages(f).map((s) => [s.key, s.status])) as Record<StageKey, string>;
const stage = (f: RoadmapFacts, k: StageKey) => computeStages(f).find((s) => s.key === k)!;
const next = (f: RoadmapFacts) => nextBestAction(computeStages(f), f);
const planDone = { id: "p", currentWeek: 8, durationWeeks: 8, tasksDone: 30, tasksTotal: 30 };

describe("profileComplete", () => {
  it("needs resume, skills, review, target role and hours", () => {
    expect(profileComplete(fullProfile)).toBe(true);
    expect(profileComplete({ ...fullProfile, hasResume: false })).toBe(false);
    expect(profileComplete({ ...fullProfile, skills: 0 })).toBe(false);
    expect(profileComplete({ ...fullProfile, targetRole: null })).toBe(false);
    expect(profileComplete({ ...fullProfile, hoursPerWeek: null })).toBe(false);
    expect(profileComplete({ ...fullProfile, reviewedSkills: 0, onboarded: false })).toBe(false);
    expect(profileComplete({ ...fullProfile, reviewedSkills: 0, onboarded: true })).toBe(true);
  });
});

describe("computeStages", () => {
  it("returns the seven stages in journey order with links", () => {
    expect(computeStages(facts()).map((s) => [s.key, s.href])).toEqual([
      ["profile", "/onboarding"],
      ["gap_map", "/gap-map"],
      ["plan", "/plan"],
      ["projects", "/projects"],
      ["interviews", "/interview"],
      ["applications", "/applications"],
      ["job_ready", "/progress"],
    ]);
  });

  it("new user: profile is next and everything else locked", () => {
    expect(status(empty)).toEqual({
      profile: "next",
      gap_map: "locked",
      plan: "locked",
      projects: "locked",
      interviews: "locked",
      applications: "locked",
      job_ready: "locked",
    });
    expect(stage(empty, "profile").metric).toBe("Missing: resume, skill review, target role, weekly hours");
  });

  it("partial profile is in progress and lists what is missing", () => {
    const f = facts({ ...empty, profile: { ...empty.profile, hasResume: true, skills: 5 } });
    expect(stage(f, "profile")).toMatchObject({
      status: "in_progress",
      metric: "Missing: skill review, target role, weekly hours",
    });
  });

  it("complete profile unlocks gap map, interviews and applications but not plan/projects", () => {
    expect(status({ ...empty, profile: fullProfile })).toMatchObject({
      profile: "done",
      gap_map: "next",
      plan: "locked",
      projects: "locked",
      interviews: "next",
      applications: "next",
    });
  });

  it("analysis without plan: plan and projects are next and automatable", () => {
    const f = facts({ plan: null, projects: { suggested: 0, inProgress: 0, done: 0 } });
    const stages = computeStages(f);
    expect(stages.find((s) => s.key === "gap_map")).toMatchObject({ status: "done", metric: "Match 62% for Data Engineer" });
    expect(stages.filter((s) => s.automatable).map((s) => s.key)).toEqual(["plan", "projects"]);
    expect(status(f)).toMatchObject({ plan: "next", projects: "next", job_ready: "in_progress" });
  });

  it("formats live metrics", () => {
    const f = facts({
      interviews: { completed: 3, avgScore: 71.4 },
      applications: { total: 8, responses: 2, offers: 0 },
    });
    expect(stage(f, "plan").metric).toBe("Week 3 of 8 · 14/30 tasks");
    expect(stage(f, "projects").metric).toBe("2 projects, 1 in progress");
    expect(stage(f, "interviews")).toMatchObject({ metric: "3 interviews, avg 71", status: "done" });
    expect(stage(f, "applications")).toMatchObject({ metric: "8 applications, 2 responses", status: "in_progress" });
    expect(stage(f, "job_ready").metric).toBe("Readiness 50% · goal 80%");
    expect(stage(f, "plan").automatable).toBe(false);
    expect(stage(f, "projects").automatable).toBe(false);
  });

  it("plan not started yet and singular wording", () => {
    const f = facts({
      plan: { id: "p", currentWeek: 0, durationWeeks: 4, tasksDone: 0, tasksTotal: 10 },
      interviews: { completed: 1, avgScore: null },
      applications: { total: 1, responses: 1, offers: 1 },
      projects: { suggested: 2, inProgress: 0, done: 0 },
    });
    expect(stage(f, "plan").metric).toBe("Starts soon · 4 weeks · 0/10 tasks");
    expect(stage(f, "interviews")).toMatchObject({ metric: "1 interview", status: "in_progress" });
    expect(stage(f, "applications")).toMatchObject({ metric: "1 application, 1 response, 1 offer", status: "done" });
    expect(stage(f, "projects")).toMatchObject({ metric: "2 projects, not started", status: "in_progress" });
  });

  it("done rules: all tasks done, a project done, 3 interviews at avg 70, readiness 0.8", () => {
    const f = facts({
      plan: planDone,
      projects: { suggested: 0, inProgress: 0, done: 1 },
      interviews: { completed: 3, avgScore: 69 },
      readiness: 0.8,
    });
    expect(status(f)).toMatchObject({ plan: "done", projects: "done", interviews: "in_progress", job_ready: "done" });
    expect(stage(facts({ readiness: 0.79 }), "job_ready").status).toBe("in_progress");
  });

  it("a plan with zero tasks is in progress, not done", () => {
    expect(stage(facts({ plan: { ...planDone, tasksDone: 0, tasksTotal: 0 } }), "plan").status).toBe("in_progress");
  });

  it("saved data is never shown as locked", () => {
    const f = facts({
      ...empty,
      interviews: { completed: 2, avgScore: 60 },
      applications: { total: 1, responses: 0, offers: 0 },
    });
    expect(status(f)).toMatchObject({ interviews: "in_progress", applications: "in_progress" });
  });
});

describe("nextBestAction", () => {
  it("walks setup stages in order", () => {
    expect(next(empty)).toBe("profile");
    expect(next({ ...empty, profile: fullProfile })).toBe("gap_map");
    expect(next(facts({ plan: null, projects: { suggested: 0, inProgress: 0, done: 0 } }))).toBe("plan");
    expect(next(facts({ projects: { suggested: 0, inProgress: 0, done: 0 } }))).toBe("projects");
  });

  it("an incomplete profile wins even when later stages have data", () => {
    expect(next(facts({ profile: { ...fullProfile, targetRole: null } }))).toBe("profile");
  });

  it("keeps working the plan early on", () => {
    expect(next(facts())).toBe("plan");
  });

  it("suggests interviews halfway through the plan or at 60% readiness", () => {
    expect(next(facts({ plan: { id: "p", currentWeek: 5, durationWeeks: 8, tasksDone: 15, tasksTotal: 30 } }))).toBe(
      "interviews",
    );
    expect(next(facts({ readiness: 0.6 }))).toBe("interviews");
  });

  it("suggests applications at 70% readiness once interviews started", () => {
    const f = facts({ readiness: 0.7, interviews: { completed: 1, avgScore: 60 } });
    expect(next(f)).toBe("applications");
    expect(next({ ...f, readiness: 0.65 })).toBe("plan");
  });

  it("after the plan is done, moves to remaining stages, then null when all done", () => {
    expect(next(facts({ plan: planDone }))).toBe("interviews");
    expect(next(facts({ plan: planDone, interviews: { completed: 3, avgScore: 80 } }))).toBe("applications");
    expect(
      next(
        facts({
          plan: planDone,
          interviews: { completed: 3, avgScore: 80 },
          applications: { total: 3, responses: 1, offers: 0 },
        }),
      ),
    ).toBe("projects");
    expect(
      next(
        facts({
          plan: planDone,
          projects: { suggested: 0, inProgress: 0, done: 2 },
          interviews: { completed: 3, avgScore: 80 },
          applications: { total: 3, responses: 1, offers: 1 },
          readiness: 0.9,
        }),
      ),
    ).toBeNull();
  });
});

describe("buildTimeline", () => {
  const task = (id: string, over: Partial<TimelineWeekInput["tasks"][number]> = {}) => ({
    id,
    title: `Task ${id}`,
    kind: "learn",
    status: "todo",
    estHours: 2,
    hoursSpent: 0,
    score: null,
    ...over,
  });
  const weeks: TimelineWeekInput[] = [
    {
      weekNumber: 1,
      goal: "Basics",
      checkpoint: "Quiz",
      content: { skills: [{ name: "SQL" }, { name: "Python" }, { name: "SQL" }, { bad: 1 }] },
      tasks: [
        task("a", { status: "done", hoursSpent: 2.25 }),
        task("b", { status: "missed" }),
        task("c"),
        task("d", { status: "skipped" }),
        task("e", { kind: "assessment", status: "done", score: 0.7 }),
      ],
    },
    {
      weekNumber: 2,
      goal: "Build",
      checkpoint: null,
      content: null,
      tasks: [task("f", { kind: "project_milestone", status: "doing" }), task("g", { kind: "assessment" })],
    },
    {
      weekNumber: 3,
      goal: "Later",
      checkpoint: null,
      content: { skills: "nope" },
      tasks: [task("h", { kind: "assessment", score: 0.4 })],
    },
  ];

  it("marks past/current/upcoming and counts progress excluding skipped", () => {
    const [w1, w2, w3] = buildTimeline(weeks, 2);
    expect(w1).toMatchObject({
      state: "past",
      skills: ["SQL", "Python"],
      tasksDone: 2,
      tasksTotal: 4,
      hoursSpent: 2.3,
      hoursPlanned: 8,
      checkpoint: { text: "Quiz", status: "passed" },
      milestones: [],
    });
    expect(w1.missed.map((t) => t.id)).toEqual(["b", "c"]);
    expect(w2).toMatchObject({ state: "current", skills: [], checkpoint: { status: "pending" } });
    expect(w2.milestones).toEqual([{ id: "f", title: "Task f", status: "doing" }]);
    expect(w2.missed).toEqual([]);
    expect(w3).toMatchObject({ state: "upcoming", skills: [], checkpoint: { status: "failed" } });
  });

  it("before the plan starts every week is upcoming; no assessments means no checkpoint", () => {
    const out = buildTimeline([{ ...weeks[1], tasks: [task("x")] }], 0);
    expect(out[0]).toMatchObject({ state: "upcoming", checkpoint: { status: "none" } });
  });

  it("a past week with a low partial score shows the checkpoint as failed", () => {
    const w = { ...weeks[1], tasks: [task("p", { kind: "assessment", score: 0.3 }), task("q", { kind: "assessment" })] };
    expect(buildTimeline([w], 3)[0].checkpoint.status).toBe("failed");
    expect(buildTimeline([w], 2)[0].checkpoint.status).toBe("pending");
  });
});
