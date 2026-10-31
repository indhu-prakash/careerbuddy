import type { Tone } from "@/components/ui/Badge";
import type { AppStatus } from "@/lib/scoring/applications";

export const STATUS_LABELS: Record<AppStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  screening: "Screening",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  ghosted: "Ghosted",
  withdrawn: "Withdrawn",
};

export const STATUS_TONES: Record<AppStatus, Tone> = {
  saved: "neutral",
  applied: "primary",
  screening: "secondary",
  interviewing: "accent",
  offer: "success",
  rejected: "danger",
  ghosted: "warning",
  withdrawn: "neutral",
};

export const pct = (n: number | null | undefined) => (n == null ? "–" : `${Math.round(n * 100)}%`);

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export const ERRORS: Record<string, string> = {
  unauthorized: "Your session expired. Sign in again.",
  invalid_body: "Some fields are invalid. Check the form and try again.",
  invalid_job_description: "That job description wasn't found.",
  invalid_resume: "That resume wasn't found.",
  missing_company: "Add the company name (or link a job description that has one).",
  missing_role_title: "Add the role title (or link a job description that has one).",
  not_found: "This application no longer exists.",
  ai_daily_limit: "You've reached today's AI limit. Advice will be available again tomorrow.",
  ai_busy: "The AI service is busy. Try again in a minute.",
  advice_failed: "We couldn't generate advice. Try again later.",
};

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(ERRORS[body.error] ?? "Something went wrong. Try again.");
  return body as T;
}
