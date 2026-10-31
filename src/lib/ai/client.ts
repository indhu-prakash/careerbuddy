import "server-only";
import { z } from "zod";

// OpenRouter free models (local development only; see ARCHITECTURE.md §4.4).
// Primary supports strict JSON-schema output; the fallback only supports JSON mode,
// so its output is still Zod-validated here.
export const MODEL_PRIMARY = process.env.AI_MODEL_PRIMARY ?? "nvidia/nemotron-3.5-super-vl:free";
export const MODEL_FALLBACK = process.env.AI_MODEL_FALLBACK ?? "google/gemma-4-31b-it:free";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Per model attempt. Free models are slow; routes using AI set maxDuration = 300.
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 150_000;

type Attempt = { model: string; strictSchema: boolean };

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
  constructor(
    readonly failures: { model: string; kind: FailureKind; message: string }[],
  ) {
    super(`All models failed.\n${failures.map((f) => `${f.model}: ${f.message}`).join("\n")}`);
  }

  get kind(): FailureKind {
    if (this.failures.every((f) => f.kind === "rate_limited")) return "rate_limited";
    if (this.failures.some((f) => f.kind === "invalid")) return "invalid";
    return "error";
  }
}

/**
 * Run a single structured-output call and return the Zod-validated result.
 * All LLM features (resume/JD extraction, plan generation, interview scoring)
 * go through here so output is always typed JSON. Tries the primary model,
 * then the fallback; throws AiProviderError if neither returns valid JSON for the schema.
 * Feature code should normally call runAiTask (service.ts), which adds logging,
 * caching and per-user limits on top of this.
 */
export async function generateStructured<T extends z.ZodType>(
  opts: StructuredOpts<T>,
): Promise<z.infer<T>> {
  return (await generateStructuredDetailed(opts)).data;
}

/** Like generateStructured, but also reports which model answered and token usage. */
export async function generateStructuredDetailed<T extends z.ZodType>(
  opts: StructuredOpts<T>,
): Promise<StructuredResult<z.infer<T>>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set.");

  const jsonSchema = z.toJSONSchema(opts.schema);
  const attempts: Attempt[] = [
    { model: MODEL_PRIMARY, strictSchema: true },
    { model: MODEL_FALLBACK, strictSchema: false },
  ];

  const failures: { model: string; kind: FailureKind; message: string }[] = [];
  for (const [index, { model, strictSchema }] of attempts.entries()) {
    for (let retry = 0; ; retry++) {
      try {
        const { data, usage } = await callModel({ ...opts, apiKey, model, strictSchema, jsonSchema });
        return { data, model, fallbackUsed: index > 0, usage };
      } catch (err) {
        // Free endpoints are often rate-limited upstream; back off briefly before moving on.
        if (err instanceof RetryableError && retry < RETRY_DELAYS_MS.length) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[retry]));
          continue;
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

const RETRY_DELAYS_MS = [3_000, 8_000];

class RetryableError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

class InvalidOutputError extends Error {}

async function callModel<T extends z.ZodType>(opts: {
  system: string;
  prompt: string;
  schema: T;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  apiKey: string;
  model: string;
  strictSchema: boolean;
  jsonSchema: unknown;
}): Promise<{ data: z.infer<T>; usage: AiUsage }> {
  // JSON mode doesn't carry the schema, so spell it out in the system prompt.
  const system = opts.strictSchema
    ? opts.system
    : `${opts.system}\n\nRespond with a single JSON object (no markdown fences) that matches this JSON Schema:\n${JSON.stringify(opts.jsonSchema)}`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Career Pivot Coach",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 16000,
      temperature: 0.2,
      reasoning: { effort: opts.effort ?? "medium", exclude: true },
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

  if (!res.ok) {
    const message = `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
    throw res.status === 429 || res.status >= 500
      ? new RetryableError(message, res.status)
      : new Error(message);
  }
  const body = await res.json();
  if (body.error) throw new Error(body.error.message ?? JSON.stringify(body.error));

  const choice = body.choices?.[0];
  if (choice?.finish_reason === "length") {
    throw new InvalidOutputError("Model output was truncated (max_tokens).");
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
    throw new InvalidOutputError(
      `Model output did not match the expected schema: ${parsed.error.message}`,
    );
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
