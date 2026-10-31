import { z } from "zod";
import { DIMENSION_LABELS, type ApplicationStats, type Dimension } from "@/lib/scoring/applications";

export const PROMPT_VERSION = "application-insights@1";

export const AdviceSchema = z.object({
  suggestions: z
    .array(z.object({ title: z.string(), detail: z.string() }))
    .min(1)
    .max(3),
});

export type ApplicationAdvice = z.infer<typeof AdviceSchema>;

export const SYSTEM = `You are a job-search coach. You get a job seeker's application statistics, already computed.
Rules:
- Write 2-3 targeting suggestions based ONLY on the numbers given. Do not invent, recompute or extrapolate numbers.
- Quote the given figures and always the sample size, e.g. "referrals: 42% response rate (5 of 12)".
- These are correlations from a small personal sample, not causes. Say "tends to", "so far", never "because".
- Prefer the biggest, best-supported differences; ignore segments that are close to the overall rate.
- title: under 10 words. detail: 1-2 sentences with a concrete next step.`;

const pct = (n: number | null) => (n == null ? "n/a" : `${Math.round(n * 100)}%`);

/** Compact stats table for the model: only segments with enough data, no company names. */
export function buildPrompt(stats: ApplicationStats): string {
  const o = stats.overall;
  const lines = [
    `<overall applications="${o.decided}" responses="${o.responses}" rate="${pct(o.rate)}" median_days_to_first_response="${o.medianDaysToResponse ?? "n/a"}" />`,
  ];
  for (const dim of Object.keys(DIMENSION_LABELS) as Dimension[]) {
    const rows = stats.segments[dim].filter((s) => s.sufficient);
    if (rows.length === 0) continue;
    lines.push(`<segments by="${DIMENSION_LABELS[dim]}">`);
    for (const s of rows) {
      lines.push(
        `- ${s.label}: ${s.responses} of ${s.applications} responded; smoothed rate ${pct(s.smoothedRate)}` +
          ` (${s.vsOverall ?? "n/a"}x overall); median days to first response ${s.medianDaysToResponse ?? "n/a"}`,
      );
    }
    lines.push("</segments>");
  }
  lines.push(
    `<note>Smoothed rates shrink small segments toward the overall rate. Segments with fewer than ${stats.minSample} applications are omitted.</note>`,
  );
  return lines.join("\n");
}
