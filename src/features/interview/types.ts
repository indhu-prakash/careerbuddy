// Client-side shapes of the /api/v1/interviews responses (dates as ISO strings).
// Server pages pass the same data through toClient() so both paths match.
import type { QuestionView, SessionListItem, SessionView } from "@/lib/interview/sessions";

type Jsonify<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Jsonify<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T;

export type Session = Jsonify<SessionView>;
export type Question = Jsonify<QuestionView>;
export type SessionSummary = NonNullable<Session["summary"]>;
export type HistoryItem = Jsonify<SessionListItem>;

export type Evaluation = {
  overallScore: number;
  criteria: { criterion: string; score: number; comment: string }[];
  strengths: string[];
  improvements: string[];
  missingConcepts: string[];
  modelAnswer: string | null;
};

export function toClient<T>(value: T): Jsonify<T> {
  return JSON.parse(JSON.stringify(value));
}

export const TYPE_LABELS: Record<string, string> = {
  technical: "Technical",
  coding: "Coding",
  behavioral: "Behavioral",
  system_design: "System design",
  scenario: "Scenario",
};

export const KIND_LABELS: Record<string, string> = {
  mixed: "Mixed",
  technical: "Technical",
  coding: "Coding",
  system_design: "System design",
  behavioral: "Behavioral",
  scenario: "Scenario",
  role_specific: "Role-specific",
};

/** User-facing message for a failed API call. */
export async function apiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  switch (body.error) {
    case "unauthorized":
      return "Your session expired. Sign in again.";
    case "ai_daily_limit":
      return `You've reached today's AI limit (${body.limit} requests). It resets at ${new Date(body.resetsAt).toLocaleTimeString()}.`;
    case "ai_busy":
      return "The AI models are busy right now. Try again in a minute.";
    case "target_role_required":
      return "Enter a target role, or run a gap analysis first.";
    case "session_closed":
      return "This interview is already finished.";
    case "already_answered":
      return "That question was already scored. Reload the page.";
    case "not_found":
      return "Not found.";
    default:
      return fallback;
  }
}
