import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  jobDescription: { findFirst: vi.fn(), findMany: vi.fn() },
  gapAnalysis: { findFirst: vi.fn() },
  roleTrack: { findMany: vi.fn() },
  resume: { findFirst: vi.fn(), findMany: vi.fn() },
  application: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  applicationEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const runAiTask = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/ai/service", () => ({ runAiTask }));

const { createApplication, updateApplication, addEvent, deleteApplication, ApplicationInputError } = await import(
  "@/lib/applications/service"
);
const { getApplicationInsights } = await import("@/lib/applications/insights");
const { ghostStaleApplications } = await import("@/lib/applications/ghost");

const USER = "11111111-1111-4111-8111-111111111111";
const JD = "22222222-2222-4222-8222-222222222222";
const APP = "33333333-3333-4333-8333-333333333333";
const DAY = 86_400_000;

beforeEach(() => {
  vi.clearAllMocks();
  db.application.create.mockImplementation(async ({ data }) => data);
  db.application.update.mockImplementation(async ({ data }) => data);
  db.applicationEvent.create.mockImplementation(async ({ data }) => data);
  db.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  db.roleTrack.findMany.mockResolvedValue([
    { id: "t1", slug: "data-engineer", title: "Data Engineer", aliases: ["data engineer"], family: "data" },
  ]);
});

describe("createApplication", () => {
  it("fills company, title, frozen match score and role family from the linked JD", async () => {
    db.jobDescription.findFirst.mockResolvedValue({
      company: "Globex",
      title: "ML Engineer at Globex",
      targetRole: { seniority: "Senior", industry: "Fintech", roleTrack: { family: "ai" } },
    });
    db.gapAnalysis.findFirst.mockResolvedValue({ matchScore: 0.62 });

    const created = await createApplication(USER, { jobDescriptionId: JD, source: "referral" });

    expect(db.jobDescription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: JD, userId: USER } }),
    );
    expect(db.gapAnalysis.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER, jobDescriptions: { some: { jobDescriptionId: JD } } },
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(created).toMatchObject({
      userId: USER,
      company: "Globex",
      roleTitle: "ML Engineer",
      matchScore: 0.62,
      roleFamily: "ai",
      seniority: "Senior",
      industry: "Fintech",
      referral: true,
      status: "applied",
      events: { create: { userId: USER, stage: "applied" } },
    });
  });

  it("matches role family from a typed title when no JD is linked", async () => {
    const created = await createApplication(USER, { company: "Initech", roleTitle: "Senior Data Engineer" });
    expect(created).toMatchObject({ roleFamily: "data", matchScore: null, referral: false });
  });

  it("rejects a JD that isn't the user's", async () => {
    db.jobDescription.findFirst.mockResolvedValue(null);
    await expect(createApplication(USER, { jobDescriptionId: JD })).rejects.toBeInstanceOf(ApplicationInputError);
    expect(db.application.create).not.toHaveBeenCalled();
  });

  it("requires a company and title when there's no JD", async () => {
    await expect(createApplication(USER, { roleTitle: "Dev" })).rejects.toMatchObject({ code: "missing_company" });
  });
});

describe("updateApplication / deleteApplication", () => {
  it("returns null for other users' applications", async () => {
    db.application.findFirst.mockResolvedValue(null);
    expect(await updateApplication(USER, APP, { notes: "x" })).toBeNull();
    expect(db.application.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: APP, userId: USER } }));
    expect(db.application.update).not.toHaveBeenCalled();
  });

  it("re-freezes match score when a different JD is linked", async () => {
    db.application.findFirst.mockResolvedValue({ jobDescriptionId: null, roleFamily: "data" });
    db.jobDescription.findFirst.mockResolvedValue({ company: "A", title: "B", targetRole: null });
    db.gapAnalysis.findFirst.mockResolvedValue({ matchScore: 0.8 });
    const updated = await updateApplication(USER, APP, { jobDescriptionId: JD });
    expect(updated).toMatchObject({ jobDescriptionId: JD, matchScore: 0.8 });
  });

  it("deletes scoped by user", async () => {
    db.application.deleteMany.mockResolvedValue({ count: 0 });
    expect(await deleteApplication(USER, APP)).toBe(false);
    expect(db.application.deleteMany).toHaveBeenCalledWith({ where: { id: APP, userId: USER } });
  });
});

describe("addEvent", () => {
  it("records the stage, moves the status and sets respondedAt on the first response", async () => {
    db.application.findFirst.mockResolvedValue({ status: "applied", respondedAt: null });
    const result = await addEvent(USER, APP, { stage: "screening", occurredAt: "2026-10-01T10:00:00Z" });
    expect(result?.event).toMatchObject({ applicationId: APP, userId: USER, stage: "screening" });
    expect(result?.application).toEqual({ status: "screening", respondedAt: new Date("2026-10-01T10:00:00Z") });
  });

  it("keeps the first respondedAt and sets appliedAt when a saved application is sent", async () => {
    db.application.findFirst.mockResolvedValue({ status: "screening", respondedAt: new Date("2026-09-01") });
    expect((await addEvent(USER, APP, { stage: "rejected" }))?.application).toEqual({ status: "rejected" });

    db.application.findFirst.mockResolvedValue({ status: "saved", respondedAt: null });
    const sent = await addEvent(USER, APP, { stage: "applied", occurredAt: "2026-10-02T00:00:00Z" });
    expect(sent?.application).toEqual({ status: "applied", appliedAt: new Date("2026-10-02T00:00:00Z") });
  });

  it("returns null for other users' applications", async () => {
    db.application.findFirst.mockResolvedValue(null);
    expect(await addEvent(USER, APP, { stage: "offer" })).toBeNull();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("getApplicationInsights", () => {
  const old = new Date(Date.now() - 60 * DAY);
  const row = (status: string, source: string, respondedAt: Date | null = null) => ({
    status,
    appliedAt: old,
    respondedAt,
    roleFamily: null,
    seniority: null,
    source,
    industry: null,
    matchScore: null,
  });

  it("does not call the LLM with fewer than 5 decided applications", async () => {
    db.application.findMany.mockResolvedValue([row("ghosted", "referral"), row("rejected", "referral")]);
    const result = await getApplicationInsights(USER, { advice: true });
    expect(result.adviceStatus).toBe("not_enough_data");
    expect(runAiTask).not.toHaveBeenCalled();
  });

  it("does not call the LLM unless advice is requested", async () => {
    db.application.findMany.mockResolvedValue([]);
    expect((await getApplicationInsights(USER, { advice: false })).adviceStatus).toBe("not_requested");
    expect(runAiTask).not.toHaveBeenCalled();
  });

  it("sends only computed stats to the LLM", async () => {
    db.application.findMany.mockResolvedValue([
      ...Array.from({ length: 3 }, () => row("screening", "referral", new Date(old.getTime() + 5 * DAY))),
      ...Array.from({ length: 3 }, () => row("ghosted", "referral")),
    ]);
    runAiTask.mockResolvedValue({ data: { suggestions: [{ title: "t", detail: "d" }] }, model: "m" });

    const result = await getApplicationInsights(USER, { advice: true });

    expect(db.application.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: USER } }));
    expect(result.adviceStatus).toBe("ok");
    const call = runAiTask.mock.calls[0][0];
    expect(call).toMatchObject({ task: "applications.advice", userId: USER });
    expect(call.prompt).toContain('applications="6" responses="3" rate="50%"');
    expect(call.prompt).toContain("Referral: 3 of 6 responded");
  });
});

describe("ghostStaleApplications", () => {
  it("ghosts only applications with no recent event and records an event", async () => {
    const now = new Date("2026-10-31T00:00:00Z");
    const ago = (d: number) => new Date(now.getTime() - d * DAY);
    db.application.findMany.mockResolvedValueOnce([
      { id: "a", userId: USER, status: "applied", appliedAt: ago(30), events: [{ occurredAt: ago(30) }] },
      { id: "b", userId: USER, status: "screening", appliedAt: ago(30), events: [{ occurredAt: ago(2) }] },
    ]);

    const result = await ghostStaleApplications(now);

    expect(result).toEqual({ ghosted: 1, days: 21 });
    expect(db.applicationEvent.create).toHaveBeenCalledTimes(1);
    expect(db.applicationEvent.create.mock.calls[0][0].data).toMatchObject({ applicationId: "a", stage: "ghosted" });
    expect(db.application.update).toHaveBeenCalledWith({ where: { id: "a" }, data: { status: "ghosted" } });
  });
});

describe("request schemas", () => {
  it("leaves absent fields out of a PATCH and turns empty strings into null", async () => {
    const { UpdateApplicationSchema, CreateApplicationSchema } = await import("@/lib/applications/schemas");
    expect(UpdateApplicationSchema.parse({ notes: "hi" })).toEqual({ notes: "hi" });
    expect(UpdateApplicationSchema.parse({ industry: "" })).toEqual({ industry: null });
    expect(UpdateApplicationSchema.safeParse({}).success).toBe(false);
    expect(CreateApplicationSchema.safeParse({ company: "A", source: "linkedin" }).success).toBe(false);
    expect(CreateApplicationSchema.safeParse({ company: "A", appliedAt: "2026-10-01" }).success).toBe(true);
  });
});
