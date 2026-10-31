import { z } from "zod";

export const PROMPT_VERSION = "resume-extract@1";

export const ResumeProfileSchema = z.object({
  currentRole: z.string(),
  yearsExperience: z.number().nullable(),
  summary: z.string(),
  skills: z.array(
    z.object({
      name: z.string(),
      evidenceType: z.enum(["demonstrated", "mentioned"]),
      quote: z.string(),
    }),
  ),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      period: z.string(),
      highlights: z.array(z.string()),
    }),
  ),
  education: z.array(z.object({ degree: z.string(), institution: z.string(), year: z.string() })),
  projects: z.array(z.object({ name: z.string(), description: z.string(), skills: z.array(z.string()) })),
  certifications: z.array(z.string()),
});

export type ResumeProfile = z.infer<typeof ResumeProfileSchema>;

export const SYSTEM = `You extract a structured profile from a resume.
Rules:
- Use only what the resume says. Never invent skills, employers, dates, degrees or certifications.
- skills: every technical, domain or tool skill. Use the common canonical name ("k8s" -> "Kubernetes", "JS" -> "JavaScript").
  evidenceType = "demonstrated" when the skill is used in a described role or project, "mentioned" when it only appears in a list.
  quote = a short verbatim excerpt (copied exactly, 3-20 words) from the resume that shows the skill.
- experience: most recent first; period as written (e.g. "2022 - Present"); 1-4 highlights copied or lightly trimmed from the resume.
- yearsExperience: total professional years if the dates allow it, otherwise null.
- Use "" for unknown text fields and [] for empty lists.`;

export function buildPrompt(resume: string): string {
  return `<resume>\n${resume}\n</resume>`;
}
