import { SectionHeading } from "@/components/ui/SectionHeading";

const STEPS = [
  {
    title: "Tell us where you are",
    body: "Upload your resume and name the role you're aiming for. Takes about a minute.",
  },
  {
    title: "See the real gap",
    body: "Paste a few real job posts. Get a match score and the skills that matter most, with evidence.",
  },
  {
    title: "Close it, step by step",
    body: "Follow the plan, build the projects, practice interviews, and track what gets replies.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-20 sm:py-28">
      <div className="px-4 sm:px-8 lg:px-12 2xl:px-16">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps from “where do I start?” to interview-ready"
          lead="No generic advice. Everything is built from your resume and the jobs you actually want."
        />
        <ol className="relative mt-14 grid gap-8 md:grid-cols-3">
          {/* Connector line behind the step numbers on desktop. */}
          <div aria-hidden className="absolute top-7 right-[16%] left-[16%] hidden h-0.5 bg-gradient-to-r from-primary via-secondary to-accent md:block" />
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative text-center">
              <span className="relative mx-auto grid size-14 place-items-center rounded-2xl border border-border bg-card font-display text-xl font-extrabold shadow-soft">
                <span className="text-gradient">{i + 1}</span>
              </span>
              <h3 className="mt-5 font-display text-lg font-bold">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
