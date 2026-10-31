import { z } from "zod";

export const PROMPT_VERSION = "jd-extract@1";

export const JdExtractionSchema = z.object({
  jobDescriptions: z.array(
    z.object({
      index: z.number().int(),
      title: z.string(),
      company: z.string(),
      seniority: z.string(),
      requirements: z.array(
        z.object({
          skill: z.string(),
          required: z.boolean(),
          requiredLevel: z.number().int().min(1).max(4),
          domain: z.boolean(),
          quote: z.string(),
        }),
      ),
    }),
  ),
});

export type JdExtraction = z.infer<typeof JdExtractionSchema>;

export const SYSTEM = `You extract skill requirements from job descriptions.
Rules:
- Return one entry per job description, with "index" equal to its index attribute.
- title is the job title only (no company name); company is the employer ("" if not stated); seniority as stated or implied ("" if unclear).
- requirements: every distinct skill, tool, technology or domain area the job asks for, listed once per job.
  Use the common canonical name ("k8s" -> "Kubernetes", "JS" -> "JavaScript").
  required = true for must-haves; false for "nice to have", "preferred", "bonus", "a plus".
  requiredLevel: 1 = familiarity/exposure, 2 = working knowledge, 3 = strong/advanced or 3+ years, 4 = expert/lead or 5+ years.
  domain = true for industry or business-domain knowledge (e.g. "payments", "healthcare compliance"), false for technical skills.
  quote = the exact phrase (copied verbatim, 3-20 words) from the job description that states the requirement.
- Do not add skills the text doesn't ask for.`;

export function buildPrompt(jds: { index: number; text: string }[]): string {
  return jds.map((jd) => `<job_description index="${jd.index}">\n${jd.text}\n</job_description>`).join("\n\n");
}
