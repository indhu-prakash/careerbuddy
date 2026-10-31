import "server-only";
import { runAiTask } from "@/lib/ai/service";
import { buildPrompt, PROMPT_VERSION, QuestionSetSchema, SYSTEM } from "@/lib/ai/prompts/interview-questions";
import type { PlannedSlot } from "./plan";

/**
 * Write the questions for every planned slot in one LLM call. Slots the model skipped
 * are dropped; throws when it returned none.
 */
export async function generateQuestions(opts: {
  userId: string;
  targetRole: string;
  seniority?: string | null;
  track?: string | null;
  slots: PlannedSlot[];
  avoid: string[];
}) {
  const { data, model } = await runAiTask({
    task: "interview.questions",
    promptVersion: PROMPT_VERSION,
    userId: opts.userId,
    system: SYSTEM,
    prompt: buildPrompt({
      targetRole: opts.targetRole,
      seniority: opts.seniority,
      track: opts.track,
      slots: opts.slots.map(({ slot, type, skill, gap }) => ({ slot, type, skill, gap })),
      avoid: opts.avoid,
    }),
    schema: QuestionSetSchema,
    effort: "low",
    maxTokens: 6000,
  });

  const bySlot = new Map<number, string>();
  for (const q of data.questions) {
    const text = q.question.trim();
    if (text.length >= 10 && !bySlot.has(q.slot)) bySlot.set(q.slot, text.slice(0, 2000));
  }
  const questions = opts.slots.flatMap((s) => {
    const question = bySlot.get(s.slot);
    return question ? [{ ...s, question }] : [];
  });
  if (questions.length === 0) throw new Error("question generation returned no usable questions");
  return { questions, model };
}
