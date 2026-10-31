import { z } from "zod";
import type { QuestionType } from "./interview-scoring";

export const PROMPT_VERSION = "interview-questions@1";

// Code decides each slot's type and skill (lib/interview/plan.ts); the model only writes
// the questions, all of them in one call to spare the free-tier daily request cap.
export const QuestionSetSchema = z.object({
  questions: z.array(z.object({ slot: z.number().int(), question: z.string() })),
});

export type QuestionSet = z.infer<typeof QuestionSetSchema>;

export const SYSTEM = `You are an experienced interviewer preparing a mock interview for a candidate.
Rules:
- Write exactly one question per slot, and return each with its slot number.
- Match the slot's type:
  technical = a conceptual or practical question about the focus skill;
  coding = a small, self-contained problem answerable in text or pseudocode within 10 minutes;
  system_design = design a system or component that relies on the focus skill;
  behavioral = "Tell me about a time..." about collaboration, ownership, learning or conflict;
  scenario = a realistic on-the-job situation for the target role that the candidate must handle.
- Pitch difficulty at the target role and seniority. A "missing" skill is new to the candidate: ask about fundamentals and practical use, not trivia.
- Each question is one or two sentences, answerable in 2-5 minutes, and must not repeat or paraphrase a question in <avoid>.`;

export type QuestionSlot = { slot: number; type: QuestionType; skill: string | null; gap: string | null };

export function buildPrompt(opts: {
  targetRole: string;
  seniority?: string | null;
  track?: string | null;
  slots: QuestionSlot[];
  avoid: string[];
}): string {
  const slots = opts.slots
    .map((s) => {
      const focus = s.skill ? ` focus="${s.skill}"${s.gap ? ` gap="${s.gap}"` : ""}` : "";
      return `<slot n="${s.slot}" type="${s.type}"${focus} />`;
    })
    .join("\n");
  return [
    `<target_role seniority="${opts.seniority ?? "unspecified"}">${opts.targetRole}</target_role>`,
    opts.track ? `<role_track>${opts.track}</role_track>` : "",
    `<slots>\n${slots}\n</slots>`,
    opts.avoid.length ? `<avoid>\n${opts.avoid.map((q) => `- ${q}`).join("\n")}\n</avoid>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
