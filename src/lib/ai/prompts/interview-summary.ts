import { z } from "zod";

export const PROMPT_VERSION = "interview-summary@1";

// The numbers (session score, weak criteria and skills, missing concepts) are computed in
// code (scoring/interview.ts) and passed in; the model only writes the narrative.
export const SessionSummarySchema = z.object({
  overview: z.string(),
  strengths: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const SYSTEM = `You are an interview coach writing a short report after a mock interview.
Rules:
- overview: 2-3 sentences on how the candidate did overall, grounded in the scores and comments given. Do not restate every number.
- strengths: 1-3 specific things the candidate did well across answers.
- nextSteps: 3-5 concrete, prioritized actions that address the recurring weaknesses, weak skills and missing concepts (what to study or practice, and how).
- Use only the evidence provided; do not invent answers the candidate did not give.`;

export type SummaryInput = {
  targetRole: string;
  sessionScore: number;
  recurringWeaknesses: { criterion: string; mean: number; count: number }[];
  weakSkills: { skillName: string; mean: number }[];
  missingConcepts: string[];
  answers: { type: string; question: string; score: number; improvements: string[] }[];
};

export function buildPrompt(input: SummaryInput): string {
  const answers = input.answers
    .map(
      (a, i) =>
        `<answer n="${i + 1}" type="${a.type}" score="${a.score}">\nQ: ${a.question}\nTo improve: ${a.improvements.join("; ") || "-"}\n</answer>`,
    )
    .join("\n");
  const list = (items: string[]) => (items.length ? items.map((s) => `- ${s}`).join("\n") : "- none");
  return [
    `<target_role>${input.targetRole}</target_role>`,
    `<session_score>${input.sessionScore}/100</session_score>`,
    `<recurring_weaknesses>\n${list(input.recurringWeaknesses.map((w) => `${w.criterion} (avg ${w.mean.toFixed(1)}/5 over ${w.count} answers)`))}\n</recurring_weaknesses>`,
    `<weak_skills>\n${list(input.weakSkills.map((s) => `${s.skillName} (${s.mean}/100)`))}\n</weak_skills>`,
    `<missing_concepts>\n${list(input.missingConcepts)}\n</missing_concepts>`,
    `<answers>\n${answers}\n</answers>`,
  ].join("\n\n");
}
