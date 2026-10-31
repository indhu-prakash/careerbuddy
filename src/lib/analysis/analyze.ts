// CLI path (scripts/analyze.ts): resume + JDs -> one LLM extraction -> deterministic
// scoring (scoring/gap.ts), nothing saved. The app uses runGapAnalysis (run.ts) instead.
import { runAiTask } from "@/lib/ai/service";
import { buildPrompt, GapExtractionSchema, PROMPT_VERSION, SYSTEM } from "@/lib/ai/prompts/gap-analysis";
import { scoreGaps } from "@/lib/scoring/gap";

export async function analyzeGap(
  resume: string,
  jds: string[],
  ctx: { userId?: string | null } = {},
) {
  const { data: extraction, model, cached } = await runAiTask({
    task: "gap.extract",
    promptVersion: PROMPT_VERSION,
    userId: ctx.userId,
    system: SYSTEM,
    prompt: buildPrompt(resume, jds),
    schema: GapExtractionSchema,
    maxTokens: 12000,
  });

  const { matchScore, items } = scoreGaps(
    extraction.jobDescriptions.map((jd) => jd.skills),
    extraction.resumeSkills,
  );

  return {
    generatedAt: new Date().toISOString(),
    promptVersion: PROMPT_VERSION,
    model,
    cached,
    candidate: extraction.candidate,
    matchScore,
    gaps: items,
    jobDescriptions: extraction.jobDescriptions,
    resumeSkills: extraction.resumeSkills,
    recommendations: extraction.recommendations,
  };
}

export type GapAnalysisResult = Awaited<ReturnType<typeof analyzeGap>>;
