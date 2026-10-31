import { SectionHeading } from "@/components/ui/SectionHeading";

// Native <details>: works without JavaScript and is keyboard accessible.
const FAQ = [
  {
    q: "How do I sign in?",
    a: "Enter your email and we send you a one-time sign-in link. There's no password to remember and no credit card.",
  },
  {
    q: "What do I need to get started?",
    a: "Your resume (PDF, DOCX or pasted text, up to 4 MB) and the role you want. For the gap map, paste or upload up to 5 real job descriptions. The more real posts you add, the more accurate the demand weighting.",
  },
  {
    q: "How long does an analysis take?",
    a: "Usually under a minute. Interview answers are scored one at a time, so you get feedback on each before moving on.",
  },
  {
    q: "Can I answer interview questions by voice?",
    a: "Yes. Record your answer in the browser, check and edit the transcript, then score it. Recordings are transcribed and dropped, never stored. You can also type your answers. A full mock interview has 3 to 8 questions mixing technical, behavioral and system-design.",
  },
  {
    q: "Does the plan change if life gets busy?",
    a: "Yes. The plan is built around the hours per week you set. If you fall behind or get ahead for two weeks running, or master a skill early, CareerBuddy proposes a new plan version and shows what changed.",
  },
  {
    q: "What happens to my resume?",
    a: "It's parsed once into your profile. Uploaded files are kept in a private store tied to your account and are only reachable through short-lived signed links. Nobody else can see your data.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. Every page works on mobile, including voice answers. The gap map and plan are easier to read on a larger screen.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 bg-muted/40 py-20 sm:py-28">
      <div className="px-4 sm:px-8 lg:px-12 2xl:px-16">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        <div className="mx-auto mt-12 grid max-w-3xl gap-3">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group rounded-2xl border border-border bg-card p-5 open:shadow-soft">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
