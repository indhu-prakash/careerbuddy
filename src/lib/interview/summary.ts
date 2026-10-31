import "server-only";
import { runAiTask } from "@/lib/ai/service";
import { buildPrompt, PROMPT_VERSION, SessionSummarySchema, SYSTEM, type SummaryInput } from "@/lib/ai/prompts/interview-summary";
import type { SessionReport } from "@/lib/scoring/interview";

export type SessionNarrative = {
  overview: string;
  strengths: string[];
  nextSteps: string[];
  source: "ai" | "fallback";
  model: string | null;
  promptVersion: string | null;
};

// Below this mean (0..100) a skill counts as weak in the report.
const WEAK_SKILL_SCORE = 60;

/**
 * Narrative for the session report: one LLM call. When the AI is unavailable (daily cap,
 * provider down) the session still completes with a narrative built from the numbers.
 */
export async function summarizeSession(opts: {
  userId: string;
  targetRole: string;
  report: SessionReport;
  answers: SummaryInput["answers"];
}): Promise<SessionNarrative> {
  const { report } = opts;
  const input: SummaryInput = {
    targetRole: opts.targetRole,
    sessionScore: report.sessionScore ?? 0,
    // Short sessions rarely repeat a criterion; then the weakest ones stand in.
    recurringWeaknesses: report.recurringWeaknesses.length
      ? report.recurringWeaknesses
      : report.criteria.filter((c) => c.mean < 3).slice(0, 3),
    weakSkills: report.skills.filter((s) => s.mean < WEAK_SKILL_SCORE),
    missingConcepts: report.missingConcepts.map((c) => c.concept),
    answers: opts.answers,
  };
  try {
    const { data, model } = await runAiTask({
      task: "interview.summary",
      promptVersion: PROMPT_VERSION,
      userId: opts.userId,
      system: SYSTEM,
      prompt: buildPrompt(input),
      schema: SessionSummarySchema,
      effort: "low",
      maxTokens: 4000,
    });
    return { ...data, source: "ai", model, promptVersion: PROMPT_VERSION };
  } catch (error) {
    console.warn("[interview] summary fell back to computed narrative", error);
    return { ...fallbackNarrative(input), source: "fallback", model: null, promptVersion: null };
  }
}

export function fallbackNarrative(input: SummaryInput): { overview: string; strengths: string[]; nextSteps: string[] } {
  const nextSteps = [
    ...input.weakSkills.slice(0, 3).map((s) => `Review ${s.skillName} and practice explaining it out loud (scored ${s.mean}/100).`),
    ...input.recurringWeaknesses.slice(0, 2).map((w) => `Work on ${w.criterion.toLowerCase()} in every answer (avg ${w.mean}/5).`),
    ...(input.missingConcepts.length
      ? [`Study the concepts your answers missed: ${input.missingConcepts.slice(0, 5).join(", ")}.`]
      : []),
  ];
  return {
    overview: `You scored ${input.sessionScore}/100 across ${input.answers.length} answer${input.answers.length === 1 ? "" : "s"}.`,
    strengths: [],
    nextSteps: nextSteps.length ? nextSteps : ["Run another mock interview on a harder set of questions."],
  };
}
