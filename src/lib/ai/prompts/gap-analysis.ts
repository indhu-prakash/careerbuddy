import { z } from "zod";

export const PROMPT_VERSION = "gap-analysis@1";

// One call extracts both sides so skill names are normalized consistently and the
// free-tier daily request cap is spent sparingly. Scoring happens in code (scoring/gap.ts).
export const GapExtractionSchema = z.object({
  candidate: z.object({
    currentRole: z.string(),
    yearsExperience: z.number(),
    summary: z.string(),
  }),
  jobDescriptions: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      skills: z.array(z.object({ skill: z.string(), required: z.boolean() })),
    }),
  ),
  resumeSkills: z.array(
    z.object({
      skill: z.string(),
      have: z.union([z.literal(0), z.literal(0.5), z.literal(1)]),
      evidence: z.string(),
    }),
  ),
  recommendations: z.array(z.string()),
});

export type GapExtraction = z.infer<typeof GapExtractionSchema>;

export const SYSTEM = `You are a career coach who extracts skills from resumes and job descriptions.
Rules:
- Normalize skill names to one canonical form and use the SAME name on both sides (e.g. "k8s" -> "Kubernetes", "JS" -> "JavaScript").
- For each job description list every distinct skill once; required=true if it is a must-have, false if "nice to have" / "preferred" / "bonus".
- For resumeSkills, include every skill that appears in ANY job description, rated against the resume:
  1 = clear evidence (used in a role or project), 0.5 = partial or adjacent evidence, 0 = no evidence.
  evidence must be a short verbatim quote from the resume, or "" when have is 0.
- Do not invent experience the resume does not show.
- recommendations: 3-6 concrete, prioritized next steps to close the biggest gaps.`;

export function buildPrompt(resume: string, jds: string[]): string {
  const jdBlocks = jds.map((jd, i) => `<job_description index="${i + 1}">\n${jd}\n</job_description>`).join("\n\n");
  return `<resume>\n${resume}\n</resume>\n\n${jdBlocks}`;
}
