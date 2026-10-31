import "server-only";
import { aiErrorResponse } from "@/lib/api";
import { InterviewError } from "./sessions";

/** Shared error mapping for the /api/v1/interviews routes. */
export function interviewErrorResponse(error: unknown, failure: string): Response {
  if (error instanceof InterviewError) return Response.json({ error: error.code }, { status: error.status });
  const ai = aiErrorResponse(error);
  if (ai) return ai;
  console.error("[interviews]", error);
  return Response.json({ error: failure }, { status: 502 });
}
