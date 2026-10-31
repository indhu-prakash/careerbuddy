import "server-only";
import { aiErrorResponse } from "@/lib/api";
import { ReplanError } from "./replan";

const STATUS: Record<ReplanError["code"], number> = { not_found: 404, not_active: 409, no_changes: 409, no_gaps: 422 };

/** Map replan failures to HTTP responses shared by the replan/accept/discard routes. */
export function replanErrorResponse(error: unknown, label: string): Response {
  if (error instanceof ReplanError) return Response.json({ error: error.code }, { status: STATUS[error.code] });
  const ai = aiErrorResponse(error);
  if (ai) return ai;
  console.error(`[${label}]`, error);
  return Response.json({ error: "replan_failed" }, { status: 502 });
}
