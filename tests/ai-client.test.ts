import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

process.env.OPENROUTER_API_KEY = "test-key";
process.env.AI_MODEL_PRIMARY = "primary/model";
process.env.AI_MODEL_FALLBACK = "fallback/model";

const { AiProviderError, generateStructuredDetailed, modelChain } = await import("@/lib/ai/client");

const schema = z.object({ answer: z.string() });
const opts = { system: "sys", prompt: "hi", schema, maxTokens: 1000 };

const ok = (content: unknown, finish = "stop") =>
  new Response(JSON.stringify({ choices: [{ finish_reason: finish, message: { content: JSON.stringify(content) } }] }));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

const bodyOf = (call: number) => JSON.parse(fetchMock.mock.calls[call][1].body);

describe("modelChain", () => {
  it("tries the configured models first, then built-in fallbacks", () => {
    const chain = modelChain();
    expect(chain.slice(0, 2)).toEqual(["primary/model", "fallback/model"]);
    expect(chain).toContain("dots-studio/dots-3-note-preview:free");
    expect(new Set(chain).size).toBe(chain.length);
  });
});

describe("generateStructuredDetailed", () => {
  it("returns the primary model's validated output", async () => {
    fetchMock.mockResolvedValueOnce(ok({ answer: "yes" }));
    const r = await generateStructuredDetailed(opts);
    expect(r).toMatchObject({ data: { answer: "yes" }, model: "primary/model", fallbackUsed: false });
    expect(bodyOf(0).reasoning.effort).toBe("low");
    expect(bodyOf(0).response_format.type).toBe("json_schema");
  });

  it("retries a truncated answer once on the same model with double the tokens", async () => {
    fetchMock.mockResolvedValueOnce(ok({}, "length")).mockResolvedValueOnce(ok({ answer: "full" }));
    const r = await generateStructuredDetailed(opts);
    expect(r.model).toBe("primary/model");
    expect(bodyOf(0).max_tokens).toBe(1000);
    expect(bodyOf(1).max_tokens).toBe(2000);
    expect(bodyOf(1).model).toBe("primary/model");
  });

  it("treats a rate limit reported in a 200 body as rate-limited and moves on", async () => {
    const limited = () => json({ message: "primary/model is temporarily rate-limited upstream." });
    fetchMock
      .mockResolvedValueOnce(limited())
      .mockResolvedValueOnce(limited()) // after the back-off
      .mockResolvedValueOnce(ok({ answer: "from fallback" }));
    const r = await generateStructuredDetailed(opts);
    expect(r).toMatchObject({ model: "fallback/model", fallbackUsed: true, data: { answer: "from fallback" } });
  }, 10_000);

  it("uses JSON mode with the schema in the prompt for JSON-only models", async () => {
    // Fail everything until the Gemma built-in fallback, which is JSON-mode only.
    fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      return body.model === "google/gemma-4-31b-it:free" ? ok({ answer: "gemma" }) : json({ error: { message: "bad request", code: 400 } }, 400);
    });
    const r = await generateStructuredDetailed(opts);
    expect(r.model).toBe("google/gemma-4-31b-it:free");
    const gemmaCall = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body)).find((b) => b.model === r.model)!;
    expect(gemmaCall.response_format.type).toBe("json_object");
    expect(gemmaCall.messages[0].content).toContain("JSON Schema");
  });

  it("reports why every model failed", async () => {
    fetchMock.mockImplementation(async () => ok({ wrong: 1 }));
    const err = await generateStructuredDetailed(opts).catch((e) => e);
    expect(err).toBeInstanceOf(AiProviderError);
    expect(err.kind).toBe("invalid");
    expect(err.failures.length).toBe(modelChain().length);
  });
});

describe("modelChain ordering", () => {
  it("puts JSON-mode-only models after strict-schema ones even if configured earlier", async () => {
    vi.resetModules();
    process.env.AI_MODEL_FALLBACK = "google/gemma-4-31b-it:free";
    const { modelChain: chain } = await import("@/lib/ai/client");
    expect(chain()).toEqual([
      "primary/model",
      "dots-studio/dots-3-note-preview:free",
      "google/gemma-4-31b-it:free",
    ]);
    process.env.AI_MODEL_FALLBACK = "fallback/model";
  });
});
