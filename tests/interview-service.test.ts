import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  interviewQuestion: {
    findFirst: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
  },
  interviewEvaluation: { create: vi.fn() },
  $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
}));
const runAiTask = vi.hoisted(() => vi.fn());
const recordProgress = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/ai/service", () => ({ runAiTask }));
vi.mock("@/lib/progress/record", () => ({ recordProgress }));
vi.mock("@/lib/analysis/load", () => ({ loadGapContext: vi.fn() }));

const { submitAnswer, InterviewError } = await import("@/lib/interview/sessions");
const { generateQuestions } = await import("@/lib/interview/generate");
const { summarizeSession } = await import("@/lib/interview/summary");
const { DEFAULT_RUBRICS } = await import("@/lib/ai/prompts/interview-scoring");

const USER = "11111111-1111-1111-1111-111111111111";
const SESSION = "22222222-2222-2222-2222-222222222222";
const QUESTION = "33333333-3333-3333-3333-333333333333";

function question(overrides: Record<string, unknown> = {}) {
  return {
    id: QUESTION,
    parentId: null,
    skillId: "skill-kafka",
    type: "technical",
    question: "How does Kafka guarantee ordering?",
    rubric: DEFAULT_RUBRICS.technical,
    evaluation: null,
    parent: null,
    session: { status: "in_progress", targetRoleTitle: "Data Engineer" },
    ...overrides,
  };
}

function llmScore(scores: [number, number, number], followUp = "What happens when a partition leader fails?") {
  return {
    data: {
      criteria: DEFAULT_RUBRICS.technical.map((c, i) => ({ criterion: c.criterion, score: scores[i], comment: "c" })),
      strengths: ["s"],
      improvements: ["i"],
      missingConcepts: ["partition keys"],
      modelAnswer: "m",
      followUp,
    },
    model: "primary",
    cached: false,
    aiCallId: "call",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.interviewQuestion.update.mockResolvedValue({});
  db.interviewQuestion.count.mockResolvedValue(0);
  db.interviewQuestion.aggregate.mockResolvedValue({ _max: { seq: 5 } });
  db.interviewQuestion.create.mockResolvedValue({});
  db.interviewEvaluation.create.mockResolvedValue({});
});

describe("submitAnswer", () => {
  it("saves the evaluation, adds a follow-up for a weak criterion and records progress", async () => {
    db.interviewQuestion.findFirst.mockResolvedValue(question());
    runAiTask.mockResolvedValue(llmScore([4, 2, 3]));

    const { evaluation, followedUp } = await submitAnswer(USER, SESSION, QUESTION, "Partitions are ordered.");

    expect(evaluation.overallScore).toBe(50); // mean 3 → 50
    expect(followedUp).toBe(true);
    expect(db.interviewQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ answer: "Partitions are ordered." }) }),
    );
    expect(db.interviewEvaluation.create.mock.calls[0][0].data).toMatchObject({
      questionId: QUESTION,
      userId: USER,
      overallScore: 50,
      missingConcepts: ["partition keys"],
      model: "primary",
    });
    expect(db.interviewQuestion.create.mock.calls[0][0].data).toMatchObject({
      sessionId: SESSION,
      parentId: QUESTION,
      skillId: "skill-kafka",
      seq: 6,
      type: "technical",
      question: "What happens when a partition leader fails?",
    });
    expect(recordProgress).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER, kind: "interview_scored", skillId: "skill-kafka", refId: QUESTION, value: 0.5 }),
    );
  });

  it("does not follow up on strong answers, follow-ups, or past the cap", async () => {
    db.interviewQuestion.findFirst.mockResolvedValue(question());
    runAiTask.mockResolvedValue(llmScore([4, 3, 5]));
    expect((await submitAnswer(USER, SESSION, QUESTION, "a")).followedUp).toBe(false);

    db.interviewQuestion.findFirst.mockResolvedValue(question({ parentId: "parent", parent: { question: "p" } }));
    runAiTask.mockResolvedValue(llmScore([1, 1, 1]));
    expect((await submitAnswer(USER, SESSION, QUESTION, "a")).followedUp).toBe(false);
    // The scoring prompt sees the question being followed up on.
    expect(runAiTask.mock.calls[1][0].prompt).toContain("<follow_up_to>");

    db.interviewQuestion.findFirst.mockResolvedValue(question());
    db.interviewQuestion.count.mockResolvedValue(2);
    expect((await submitAnswer(USER, SESSION, QUESTION, "a")).followedUp).toBe(false);

    expect(db.interviewQuestion.create).not.toHaveBeenCalled();
  });

  it("skips progress for questions without a skill", async () => {
    db.interviewQuestion.findFirst.mockResolvedValue(question({ skillId: null, type: "behavioral", rubric: null }));
    runAiTask.mockResolvedValue({
      ...llmScore([3, 3, 3]),
      data: { ...llmScore([3, 3, 3]).data, criteria: [] },
    });
    await submitAnswer(USER, SESSION, QUESTION, "a");
    expect(recordProgress).not.toHaveBeenCalled();
  });

  it("rejects other users' questions, closed sessions and already-scored questions", async () => {
    db.interviewQuestion.findFirst.mockResolvedValue(null);
    await expect(submitAnswer(USER, SESSION, QUESTION, "a")).rejects.toMatchObject({ code: "not_found", status: 404 });

    db.interviewQuestion.findFirst.mockResolvedValue(question({ session: { status: "completed", targetRoleTitle: null } }));
    await expect(submitAnswer(USER, SESSION, QUESTION, "a")).rejects.toBeInstanceOf(InterviewError);

    db.interviewQuestion.findFirst.mockResolvedValue(question({ evaluation: { id: "e" } }));
    await expect(submitAnswer(USER, SESSION, QUESTION, "a")).rejects.toMatchObject({ code: "already_answered" });

    expect(runAiTask).not.toHaveBeenCalled();
    expect(db.interviewQuestion.findFirst.mock.calls[0][0].where).toEqual({ id: QUESTION, sessionId: SESSION, userId: USER });
  });
});

describe("generateQuestions", () => {
  it("makes one call and maps questions back to their planned slots", async () => {
    runAiTask.mockResolvedValue({
      data: {
        questions: [
          { slot: 2, question: "Tell me about a time you disagreed with a teammate." },
          { slot: 1, question: "Explain Kafka consumer groups." },
          { slot: 3, question: "" },
        ],
      },
      model: "primary",
    });
    const { questions } = await generateQuestions({
      userId: USER,
      targetRole: "Data Engineer",
      avoid: [],
      slots: [
        { slot: 1, type: "technical", skillId: "k", skill: "Kafka", gap: "missing" },
        { slot: 2, type: "behavioral", skillId: null, skill: null, gap: null },
        { slot: 3, type: "scenario", skillId: "s", skill: "Spark", gap: "partial" },
      ],
    });
    expect(runAiTask).toHaveBeenCalledTimes(1);
    expect(questions.map((q) => [q.slot, q.skillId, q.question])).toEqual([
      [1, "k", "Explain Kafka consumer groups."],
      [2, null, "Tell me about a time you disagreed with a teammate."],
    ]);
  });
});

describe("summarizeSession", () => {
  const report = {
    sessionScore: 42,
    answered: 2,
    criteria: [{ criterion: "Depth", mean: 2, count: 2, low: 1 }],
    recurringWeaknesses: [],
    skills: [{ skillId: "k", skillName: "Kafka", mean: 30, count: 1 }],
    missingConcepts: [{ concept: "idempotency", count: 1 }],
  };

  it("falls back to a computed narrative when the AI is unavailable", async () => {
    runAiTask.mockRejectedValue(new Error("daily limit"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const narrative = await summarizeSession({ userId: USER, targetRole: "Data Engineer", report, answers: [] });

    expect(narrative.source).toBe("fallback");
    expect(narrative.overview).toContain("42/100");
    expect(narrative.nextSteps.join(" ")).toContain("Kafka");
    expect(narrative.nextSteps.join(" ")).toContain("idempotency");
    warn.mockRestore();
  });

  it("passes the weakest criteria when none recur", async () => {
    runAiTask.mockResolvedValue({ data: { overview: "o", strengths: [], nextSteps: ["n"] }, model: "primary" });
    const narrative = await summarizeSession({ userId: USER, targetRole: "Data Engineer", report, answers: [] });
    expect(narrative).toMatchObject({ source: "ai", overview: "o", model: "primary" });
    expect(runAiTask.mock.calls[0][0].prompt).toContain("Depth (avg 2.0/5");
  });
});
