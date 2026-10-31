import { z } from "zod";

export const PROMPT_VERSION = "interview-scoring@2";
// Bump when DEFAULT_RUBRICS change; stored on InterviewSession.rubricVersion.
export const RUBRIC_VERSION = "rubrics@2";

// Mirrors the QuestionType enum in prisma/schema.prisma.
export const QUESTION_TYPES = ["technical", "coding", "behavioral", "system_design", "scenario"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type RubricCriterion = { criterion: string; description: string };

// Default rubric per question type. Stored on InterviewQuestion.rubric once questions are generated.
export const DEFAULT_RUBRICS: Record<QuestionType, RubricCriterion[]> = {
  technical: [
    { criterion: "Correctness", description: "Facts, definitions and reasoning are accurate." },
    { criterion: "Depth", description: "Goes beyond definitions: trade-offs, edge cases, real usage." },
    { criterion: "Communication", description: "Clear, organized and concise." },
  ],
  coding: [
    { criterion: "Approach", description: "Picks a working algorithm or design and explains why." },
    { criterion: "Correctness", description: "Handles the edge cases; the code or pseudocode would work." },
    { criterion: "Complexity", description: "States and justifies time and space complexity." },
    { criterion: "Communication", description: "Clear, organized and concise." },
  ],
  behavioral: [
    { criterion: "STAR structure", description: "Covers Situation, Task, Action and Result in order." },
    { criterion: "Ownership", description: "Shows the candidate's own actions and decisions, not just the team's." },
    { criterion: "Impact", description: "States a concrete, ideally measurable result and what was learned." },
    { criterion: "Communication", description: "Clear, organized and concise." },
  ],
  system_design: [
    { criterion: "Requirements", description: "Clarifies functional and non-functional requirements and scale." },
    { criterion: "Architecture", description: "Sensible components, data flow and storage choices." },
    { criterion: "Trade-offs", description: "Names alternatives, bottlenecks and why one was chosen." },
    { criterion: "Communication", description: "Clear, organized and concise." },
  ],
  scenario: [
    { criterion: "Problem framing", description: "Identifies the real problem, constraints and stakeholders." },
    { criterion: "Judgment", description: "Proposes sensible, prioritized actions and weighs the risks." },
    { criterion: "Domain knowledge", description: "Applies role-specific tools and practices correctly." },
    { criterion: "Communication", description: "Clear, organized and concise." },
  ],
};

// Every field is required: the primary model uses strict JSON-schema output.
export const AnswerScoreSchema = z.object({
  criteria: z.array(
    z.object({
      criterion: z.string(),
      score: z.number().int().min(1).max(5),
      comment: z.string(),
    }),
  ),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  missingConcepts: z.array(z.string()),
  modelAnswer: z.string(),
  // Wording only; code decides whether a follow-up is actually asked (lib/interview/plan.ts).
  followUp: z.string(),
});

export type AnswerScore = z.infer<typeof AnswerScoreSchema>;

export const SYSTEM = `You are a strict but fair interviewer scoring a candidate's answer against a rubric.
Rules:
- Score EVERY rubric criterion, using its exact name, on a 1-5 scale:
  1 = missing or wrong, 2 = weak, 3 = acceptable, 4 = strong, 5 = excellent.
- Judge only what the answer says. Do not give credit for things the candidate did not say.
- The answer may be a speech-to-text transcript: ignore filler words, minor grammar slips and obvious transcription errors.
- Each comment is one or two sentences explaining the score, quoting the answer where useful.
- strengths and improvements: 1-3 items each, specific and actionable.
- missingConcepts: 0-5 short names of concepts a strong answer would mention that this one did not (e.g. "idempotency", "index selectivity").
- modelAnswer: a concise, strong answer to the same question (under 200 words; for behavioral questions use STAR with a realistic example).
- followUp: if any criterion scores 2 or lower, one short follow-up question an interviewer would ask to probe the weakest criterion; otherwise "".`;

export function buildPrompt(opts: {
  question: string;
  type: QuestionType;
  answer: string;
  rubric: RubricCriterion[];
  targetRole?: string;
  parentQuestion?: string; // set when scoring a follow-up
}): string {
  const rubric = opts.rubric.map((c) => `- ${c.criterion}: ${c.description}`).join("\n");
  return [
    opts.targetRole ? `<target_role>${opts.targetRole}</target_role>` : "",
    opts.parentQuestion ? `<follow_up_to>\n${opts.parentQuestion}\n</follow_up_to>` : "",
    `<question type="${opts.type}">\n${opts.question}\n</question>`,
    `<rubric>\n${rubric}\n</rubric>`,
    `<answer>\n${opts.answer}\n</answer>`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
