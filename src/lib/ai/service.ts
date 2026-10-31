import "server-only";
import { createHash } from "node:crypto";
import type { z } from "zod";
import { db } from "@/lib/db";
import type { AiCallOutcome } from "@/generated/prisma/client";
import { AiProviderError, generateStructuredDetailed, type AiUsage } from "@/lib/ai/client";

/**
 * Per-user cap on model requests per UTC day. The OpenRouter free tier allows 50
 * requests/day for the whole account (1,000 after buying 10 credits), so this keeps one
 * user from exhausting it. Cache hits don't count.
 */
export function aiDailyLimit(): number {
  const n = Number(process.env.AI_DAILY_REQUEST_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 20;
}

export class AiBudgetExceededError extends Error {
  readonly status = 429;
  constructor(
    readonly limit: number,
    readonly resetsAt: Date,
  ) {
    super(`Daily AI request limit reached (${limit}).`);
  }
}

export type AiTaskResult<T> = {
  data: T;
  model: string | null;
  cached: boolean;
  aiCallId: string | null;
};

/**
 * The single entry point for AI features: identical requests (same task, prompt
 * version and input) from the same user are served from cache; otherwise the user's
 * daily limit is checked, the model chain is called, and the call is logged to ai_calls.
 */
export async function runAiTask<T extends z.ZodType>(opts: {
  task: string; // e.g. "gap.extract"
  promptVersion: string;
  userId?: string | null; // null for scripts
  system: string;
  prompt: string;
  schema: T;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  cache?: boolean; // default true
}): Promise<AiTaskResult<z.infer<T>>> {
  const userId = opts.userId ?? null;
  const inputHash = hashInput(opts.task, opts.promptVersion, opts.system, opts.prompt);
  const base = { userId, task: opts.task, promptVersion: opts.promptVersion, inputHash };

  if (opts.cache !== false) {
    const hit = await findCached(base, opts.schema);
    if (hit) {
      const aiCallId = await logCall({ ...base, outcome: "cache_hit", model: hit.model });
      return { data: hit.data, model: hit.model, cached: true, aiCallId };
    }
  }

  if (userId) {
    const usage = await getAiUsageToday(userId);
    if (usage.remaining <= 0) {
      await logCall({ ...base, outcome: "budget_exceeded" });
      throw new AiBudgetExceededError(usage.limit, usage.resetsAt);
    }
  }

  const started = Date.now();
  try {
    const result = await generateStructuredDetailed(opts);
    const aiCallId = await logCall({
      ...base,
      outcome: result.fallbackUsed ? "fallback" : "ok",
      model: result.model,
      usage: result.usage,
      latencyMs: Date.now() - started,
      result: result.data,
    });
    return { data: result.data, model: result.model, cached: false, aiCallId };
  } catch (error) {
    const outcome: AiCallOutcome =
      error instanceof AiProviderError
        ? error.kind === "rate_limited"
          ? "rate_limited"
          : error.kind === "invalid"
            ? "invalid"
            : "error"
        : "error";
    await logCall({
      ...base,
      outcome,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message.slice(0, 2000) : String(error),
    });
    throw error;
  }
}

/** Model requests the user has made today (UTC), against their daily limit. */
export async function getAiUsageToday(userId: string) {
  const start = startOfUtcDay(new Date());
  const used = await db.aiCall.count({
    where: {
      userId,
      createdAt: { gte: start },
      outcome: { notIn: ["cache_hit", "budget_exceeded"] },
    },
  });
  const limit = aiDailyLimit();
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
}

export function hashInput(...parts: string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part).update("\u0000");
  return hash.digest("hex");
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function findCached<T extends z.ZodType>(
  key: { userId: string | null; task: string; inputHash: string },
  schema: T,
): Promise<{ data: z.infer<T>; model: string | null } | null> {
  const row = await db.aiCall.findFirst({
    where: { ...key, outcome: { in: ["ok", "fallback"] } },
    orderBy: { createdAt: "desc" },
    select: { result: true, model: true },
  });
  if (!row?.result) return null;
  // A schema change makes old results unusable; treat them as a miss.
  const parsed = schema.safeParse(row.result);
  return parsed.success ? { data: parsed.data, model: row.model } : null;
}

// Logging must never break the feature itself.
async function logCall(entry: {
  userId: string | null;
  task: string;
  promptVersion: string;
  inputHash: string;
  outcome: AiCallOutcome;
  model?: string | null;
  usage?: AiUsage;
  latencyMs?: number;
  error?: string;
  result?: unknown;
}): Promise<string | null> {
  try {
    const row = await db.aiCall.create({
      data: {
        userId: entry.userId,
        task: entry.task,
        promptVersion: entry.promptVersion,
        inputHash: entry.inputHash,
        outcome: entry.outcome,
        model: entry.model ?? null,
        promptTokens: entry.usage?.promptTokens ?? null,
        completionTokens: entry.usage?.completionTokens ?? null,
        costUsd: entry.usage?.costUsd ?? null,
        latencyMs: entry.latencyMs ?? null,
        error: entry.error ?? null,
        result: entry.result === undefined ? undefined : (entry.result as object),
      },
      select: { id: true },
    });
    return row.id;
  } catch (error) {
    console.warn("[ai] could not log call", error);
    return null;
  }
}
