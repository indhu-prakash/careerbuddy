import "server-only";
import type { z } from "zod";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { AiProviderError } from "@/lib/ai/client";
import { AiBudgetExceededError } from "@/lib/ai/service";

export type AppUser = Awaited<ReturnType<typeof requireUser>>;

/**
 * Wrap a route handler so it only runs for a signed-in user (401 otherwise).
 *   export const GET = withUser(async (user, request, { params }) => ...)
 */
export function withUser<Ctx = unknown>(
  handler: (user: AppUser, request: Request, ctx: Ctx) => Promise<Response>,
) {
  return async (request: Request, ctx: Ctx): Promise<Response> => {
    let user: AppUser;
    try {
      user = await requireUser();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      throw error;
    }
    return handler(user, request, ctx);
  };
}

/** Parse and validate a JSON body. Returns the data, or a 400 Response to return as-is. */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: Response }> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return {
      response: Response.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 }),
    };
  }
  return { data: parsed.data };
}

/**
 * HTTP response for AI failures that the user should see as such: daily limit (429)
 * and provider rate limits (503). Returns null for other errors, which should be
 * logged and mapped to the route's own failure response.
 */
export function aiErrorResponse(error: unknown): Response | null {
  if (error instanceof AiBudgetExceededError) {
    return Response.json(
      { error: "ai_daily_limit", limit: error.limit, resetsAt: error.resetsAt },
      { status: 429 },
    );
  }
  if (error instanceof AiProviderError && error.kind === "rate_limited") {
    return Response.json({ error: "ai_busy" }, { status: 503, headers: { "Retry-After": "60" } });
  }
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function notFound(): Response {
  return Response.json({ error: "not_found" }, { status: 404 });
}
