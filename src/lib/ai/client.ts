import "server-only";
import { z } from "zod";

// OpenRouter free models (development and demos only; see ARCHITECTURE.md §4.4).
// The chain is tried in order: AI_MODEL_PRIMARY, then AI_MODEL_FALLBACK (comma-separated),
// then built-in fallbacks not already listed. Free endpoints are often rate-limited
// upstream, so a single fallback isn't enough in practice.
export const MODEL_PRIMARY = process.env.AI_MODEL_PRIMARY?.trim() || "nvidia/nemotron-3.5-super-vl:free";
export const MODEL_FALLBACK = process.env.AI_MODEL_FALLBACK?.trim() || "dots-studio/dots-3-note-preview:free";

// Verified 2026-11-01 to return schema-valid output on the resume-extraction prompt.
const BUILTIN_FALLBACKS = ["dots-studio/dots-3-note-preview:free", "google/gemma-4-31b-it:free"];

// Models whose free endpoint supports JSON mode but not strict JSON schemas. For these the
// schema is spelled out in the system prompt instead. Extend with AI_JSON_MODE_MODELS.
const JSON_MODE_ONLY = new Set([
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "recursive/flint-v1.0:free",
  ...(process.env.AI_JSON_MODE_MODELS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
]);

export function modelChain(): string[] {
  const listed = [MODEL_PRIMARY, ...MODEL_FALLBACK.split(",").map((s) => s.trim())].filter(Boolean);
  const all = [...new Set([...listed, ...BUILTIN_FALLBACKS])];
  // Strict-schema models first: JSON-mode output fails validation more often, and the
  // free Gemma endpoints are frequently rate-limited upstream.
  return [...all.filter((m) => !JSON_MODE_ONLY.has(m)), ...all.filter((m) => JSON_MODE_ONLY.has(m))];
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Per model attempt. Free models are slow; routes using AI set maxDuration = 300.
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 150_000;
// Whole chain, kept under Vercel's 300 s function limit so a failure is always logged and
// returned as an error instead of the function being killed mid-request.
const TOTAL_BUDGET_MS = Number(process.env.AI_TOTAL_BUDGET_MS) || 270_000;
const MIN_ATTEMPT_MS = 20_000;
// Reasoning tokens count against max_tokens; a truncated answer is retried once with more room.
const MAX_TOKENS_CEILING = 32_000;

type StructuredOpts<T extends z.ZodType> = {
  system: string;
  prompt: string;
  schema: T;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
};

export type AiUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null; // as reported by OpenRouter; 0 for free models
};

export type StructuredResult<T> = {
  data: T;
  model: string;
  fallbackUsed: boolean;
  usage: AiUsage;
};

export type FailureKind = "rate_limited" | "invalid" | "error";

/** Every model in the chain failed. `kind` summarises why, for logging and HTTP mapping. */
export class AiProviderError extends Error {
  constructor(readonly failures: { model: string; kind: FailureKind; message: string }[]) {
    super(`All models failed.\n${failures.map((f) => `${f.model}: ${f.message}`).join("\n")}`);
  }

  get kind(): FailureKind {
    if (this.failures.length && this.failures.every((f) => f.kind === "rate_limited")) return "rate_limited";
    if (this.failures.some((f) => f.kind === "invalid")) return "invalid";
    return "error";
  }
}

/**
 * Run a single structured-output call and return the Zod-validated result.
 * All LLM features (resume/JD extraction, plan generation, interview scoring)
 * go through here so output is always typed JSON. Tries each model in the chain;
 * throws AiProviderError if none returns valid JSON for the schema.
 * Feature code should normally call runAiTask (service.ts), which adds logging,
 * caching and per-user limits on top of this.
 */
export async function generateStructured<T extends z.ZodType>(opts: StructuredOpts<T>): Promise<z.infer<T>> {
  return (await generateStructuredDetailed(opts)).data;
}

/** Like generateStructured, but also reports which model answered and token usage. */
export async function generateStructuredDetailed<T extends z.ZodType>(
  opts: StructuredOpts<T>,
): Promise<StructuredResult<z.infer<T>>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set.");

  const jsonSchema = z.toJSONSchema(opts.schema);
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const failures: { model: string; kind: FailureKind; message: string }[] = [];

  for (const [index, model] of modelChain().entries()) {
    let maxTokens = opts.maxTokens ?? 16_000;
    let retried429 = 0;
    let retriedLength = false;
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining < MIN_ATTEMPT_MS) {
        failures.push({ model, kind: "error", message: "Skipped: out of time for this request." });
        break;
      }
      try {
        const { data, usage } = await callModel({
          ...opts,
          apiKey,
          model,
          maxTokens,
          strictSchema: !JSON_MODE_ONLY.has(model),
          jsonSchema,
          timeoutMs: Math.min(TIMEOUT_MS, remaining - 5_000),
        });
        return { data, model, fallbackUsed: index > 0, usage };
      } catch (err) {
        if (err instanceof TruncatedError && !retriedLength && maxTokens < MAX_TOKENS_CEILING) {
          retriedLength = true;
          maxTokens = Math.min(MAX_TOKENS_CEILING, maxTokens * 2);
          continue;
        }
        // Upstream rate limits are usually brief; one short back-off, then move on.
        if (err instanceof RetryableError && retried429 < RETRY_DELAYS_MS.length) {
          const delay = RETRY_DELAYS_MS[retried429++];
          if (deadline - Date.now() - delay > MIN_ATTEMPT_MS) {
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
        }
        const message = err instanceof Error ? err.message : String(err);
        const kind: FailureKind =
          err instanceof RetryableError && err.status === 429
            ? "rate_limited"
            : err instanceof InvalidOutputError
              ? "invalid"
              : "error";
        console.warn(`[ai] ${model}: ${message}`);
        failures.push({ model, kind, message });
        break;
      }
    }
  }
  throw new AiProviderError(failures);
}

const RETRY_DELAYS_MS = [3_000];

class RetryableError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

class InvalidOutputError extends Error {}
class TruncatedError extends InvalidOutputError {}

async function callModel<T extends z.ZodType>(opts: {
  system: string;
  prompt: string;
  schema: T;
  effort?: "low" | "medium" | "high";
  maxTokens: number;
  apiKey: string;
  model: string;
  strictSchema: boolean;
  jsonSchema: unknown;
  timeoutMs: number;
}): Promise<{ data: z.infer<T>; usage: AiUsage }> {
  // JSON mode doesn't carry the schema, so spell it out in the system prompt.
  const system = opts.strictSchema
    ? opts.system
    : `${opts.system}\n\nRespond with a single JSON object (no markdown fences) that matches this JSON Schema:\n${JSON.stringify(opts.jsonSchema)}`;

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: AbortSignal.timeout(opts.timeoutMs),
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Career Pivot Coach",
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        temperature: 0.2,
        // Low effort by default: extraction and scoring don't need long reasoning, and
        // reasoning tokens eat into max_tokens and latency.
        reasoning: { effort: opts.effort ?? "low", exclude: true },
        usage: { include: true },
        messages: [
          { role: "system", content: system },
          { role: "user", content: opts.prompt },
        ],
        response_format: opts.strictSchema
          ? { type: "json_schema", json_schema: { name: "output", strict: true, schema: opts.jsonSchema } }
          : { type: "json_object" },
      }),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error(`Timed out after ${Math.round(opts.timeoutMs / 1000)} s.`);
    }
    throw err;
  }

  if (!res.ok) {
    const message = `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
    throw res.status === 429 || res.status >= 500 ? new RetryableError(message, res.status) : new Error(message);
  }
  const body = await res.json();
  // OpenRouter sometimes reports upstream errors in a 200 body instead of the status code.
  const errorMessage: string | undefined = body.error?.message ?? (body.choices ? undefined : body.message);
  if (errorMessage || body.error) {
    const code = Number(body.error?.code);
    const message = errorMessage ?? JSON.stringify(body.error);
    if (code === 429 || /rate-limited|rate limit/i.test(message)) throw new RetryableError(message, 429);
    if (code >= 500) throw new RetryableError(message, code);
    throw new Error(message);
  }

  const choice = body.choices?.[0];
  if (choice?.finish_reason === "length") {
    throw new TruncatedError(`Model output was truncated (max_tokens ${opts.maxTokens}).`);
  }
  const content: string | undefined = choice?.message?.content;
  if (!content) throw new InvalidOutputError("Model returned no content.");

  let data: unknown;
  try {
    data = JSON.parse(stripFences(content));
  } catch {
    throw new InvalidOutputError("Model output was not valid JSON.");
  }
  const parsed = opts.schema.safeParse(data);
  if (!parsed.success) {
    throw new InvalidOutputError(`Model output did not match the expected schema: ${parsed.error.message}`);
  }
  const usage: AiUsage = {
    promptTokens: numberOrNull(body.usage?.prompt_tokens),
    completionTokens: numberOrNull(body.usage?.completion_tokens),
    costUsd: numberOrNull(body.usage?.cost),
  };
  return { data: parsed.data, usage };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stripFences(text: string): string {
  const m = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : text.trim();
}
