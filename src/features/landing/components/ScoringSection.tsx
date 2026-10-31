import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";

// Mirrors the deterministic scorers in src/lib/scoring (gap.ts, interview.ts,
// replan.ts, applications.ts). Keep the numbers in sync if those change.
const SCORES = [
  {
    title: "Match score",
    formula: "Σ demand × have ÷ Σ demand",
    body: "Each skill's demand is how many of your job posts mention it, counted in full when required and at half weight when it's a nice-to-have. Have is 1, ½ or 0 depending on the evidence in your resume.",
  },
  {
    title: "Interview score",
    formula: "rubric 1–5 → 0–100",
    body: "Every rubric criterion is scored 1 to 5. A criterion the AI skips counts as 1, never as missing, and the average is mapped onto 0–100.",
  },
  {
    title: "Re-plan triggers",
    formula: "< 70% or > 120% of planned hours",
    body: "Two weeks in a row below 70% of your planned hours, or above 120%, suggests a new plan, as do mastered or still-weak skills. You see what changed and choose whether to accept.",
  },
  {
    title: "Response rates",
    formula: "smoothed, 5+ outcomes per group",
    body: "Rates per source, role, company size, match band and tailored vs. not are pulled toward your overall rate, so one reply from one application never reads as 100%.",
  },
];

export function ScoringSection() {
  return (
    <section id="scoring" className="scroll-mt-20 py-20 sm:py-28">
      <div className="px-4 sm:px-8 lg:px-12 2xl:px-16">
        <SectionHeading
          eyebrow="Under the hood"
          title="AI reads and writes. Code keeps score."
          lead="The AI extracts skills, drafts plans and writes feedback. Every number you see comes from plain, tested code, so the same input always gets the same score."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {SCORES.map((s) => (
            <Card key={s.title}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-lg font-bold">{s.title}</h3>
                <code className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{s.formula}</code>
              </div>
              <p className="mt-2 text-muted-foreground">{s.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
