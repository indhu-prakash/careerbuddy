import "server-only";
import { runAiTask } from "@/lib/ai/service";
import {
  AnswerScoreSchema,
  buildPrompt,
  DEFAULT_RUBRICS,
  PROMPT_VERSION,
  SYSTEM,
  type QuestionType,
  type RubricCriterion,
} from "@/lib/ai/prompts/interview-scoring";
import { scoreAnswer } from "@/lib/scoring/interview";

/**
 * Score one interview answer (typed, or a speech-to-text transcript) against a rubric.
 * One LLM call, which also suggests follow-up wording; the overall score is computed in code.
 */
export async function evaluateAnswer(opts: {
  question: string;
  type: QuestionType;
  answer: string;
  rubric?: RubricCriterion[];
  targetRole?: string;
  parentQuestion?: string;
  userId?: string | null;
}) {
  const rubric = opts.rubric ?? DEFAULT_RUBRICS[opts.type];
  const { data: llm, model } = await runAiTask({
    task: "interview.score",
    promptVersion: PROMPT_VERSION,
    userId: opts.userId,
    system: SYSTEM,
    prompt: buildPrompt({ ...opts, rubric }),
    schema: AnswerScoreSchema,
    effort: "low",
    maxTokens: 6000,
  });
  const { criteria, overallScore } = scoreAnswer(rubric, llm.criteria);
  return {
    overallScore,
    criteria,
    strengths: llm.strengths,
    improvements: llm.improvements,
    missingConcepts: llm.missingConcepts.slice(0, 5),
    modelAnswer: llm.modelAnswer,
    followUp: llm.followUp,
    model,
    promptVersion: PROMPT_VERSION,
  };
}

export type AnswerEvaluation = Awaited<ReturnType<typeof evaluateAnswer>>;
