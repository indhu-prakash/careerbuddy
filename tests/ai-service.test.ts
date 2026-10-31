import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const db = vi.hoisted(() => ({
  aiCall: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
}));
const generateStructuredDetailed = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/ai/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/client")>()),
  generateStructuredDetailed,
}));

const { runAiTask, AiBudgetExceededError, hashInput } = await import("@/lib/ai/service");
const { AiProviderError } = await import("@/lib/ai/client");

const schema = z.object({ answer: z.string() });
const task = {
  task: "test.task",
  promptVersion: "test@1",
  userId: "11111111-1111-1111-1111-111111111111",
  system: "sys",
  prompt: "hello",
  schema,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.aiCall.findFirst.mockResolvedValue(null);
  db.aiCall.count.mockResolvedValue(0);
  db.aiCall.create.mockResolvedValue({ id: "call-1" });
});

describe("runAiTask", () => {
  it("calls the model, logs the call with usage and returns the result", async () => {
    generateStructuredDetailed.mockResolvedValue({
      data: { answer: "hi" },
      model: "primary",
      fallbackUsed: false,
      usage: { promptTokens: 10, completionTokens: 5, costUsd: 0 },
    });

    const result = await runAiTask(task);

    expect(result).toEqual({ data: { answer: "hi" }, model: "primary", cached: false, aiCallId: "call-1" });
    const logged = db.aiCall.create.mock.calls[0][0].data;
    expect(logged).toMatchObject({
      outcome: "ok",
      model: "primary",
      promptTokens: 10,
      completionTokens: 5,
      result: { answer: "hi" },
      inputHash: hashInput("test.task", "test@1", "sys", "hello"),
    });
  });

  it("serves identical requests from cache without calling the model", async () => {
    db.aiCall.findFirst.mockResolvedValue({ result: { answer: "cached" }, model: "primary" });

    const result = await runAiTask(task);

    expect(result.cached).toBe(true);
    expect(result.data).toEqual({ answer: "cached" });
    expect(generateStructuredDetailed).not.toHaveBeenCalled();
    expect(db.aiCall.create.mock.calls[0][0].data.outcome).toBe("cache_hit");
  });

  it("ignores cached results that no longer match the schema", async () => {
    db.aiCall.findFirst.mockResolvedValue({ result: { wrong: 1 }, model: "primary" });
    generateStructuredDetailed.mockResolvedValue({
      data: { answer: "fresh" },
      model: "primary",
      fallbackUsed: false,
      usage: { promptTokens: null, completionTokens: null, costUsd: null },
    });

    expect((await runAiTask(task)).data).toEqual({ answer: "fresh" });
  });

  it("refuses when the user's daily limit is reached", async () => {
    db.aiCall.count.mockResolvedValue(1000);

    await expect(runAiTask(task)).rejects.toBeInstanceOf(AiBudgetExceededError);
    expect(generateStructuredDetailed).not.toHaveBeenCalled();
    expect(db.aiCall.create.mock.calls[0][0].data.outcome).toBe("budget_exceeded");
  });

  it("logs fallback and rate-limit outcomes", async () => {
    generateStructuredDetailed.mockResolvedValueOnce({
      data: { answer: "fb" },
      model: "fallback",
      fallbackUsed: true,
      usage: { promptTokens: null, completionTokens: null, costUsd: null },
    });
    await runAiTask(task);
    expect(db.aiCall.create.mock.calls[0][0].data.outcome).toBe("fallback");

    generateStructuredDetailed.mockRejectedValueOnce(
      new AiProviderError([
        { model: "primary", kind: "rate_limited", message: "429" },
        { model: "fallback", kind: "rate_limited", message: "429" },
      ]),
    );
    await expect(runAiTask(task)).rejects.toBeInstanceOf(AiProviderError);
    expect(db.aiCall.create.mock.calls[1][0].data.outcome).toBe("rate_limited");
  });

  it("still returns the result when logging fails", async () => {
    db.aiCall.create.mockRejectedValue(new Error("db down"));
    generateStructuredDetailed.mockResolvedValue({
      data: { answer: "ok" },
      model: "primary",
      fallbackUsed: false,
      usage: { promptTokens: null, completionTokens: null, costUsd: null },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await runAiTask(task);

    expect(result.data).toEqual({ answer: "ok" });
    expect(result.aiCallId).toBeNull();
    warn.mockRestore();
  });
});
