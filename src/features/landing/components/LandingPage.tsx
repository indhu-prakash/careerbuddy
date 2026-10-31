import { SectionHeading } from "@/components/ui/SectionHeading";
import { FEATURES, type FeatureId } from "@/features/catalog";
import { AudienceSection } from "./AudienceSection";
import { FaqSection } from "./FaqSection";
import { FeatureSection, type FeatureCopy } from "./FeatureSection";
import { FinalCta } from "./FinalCta";
import { HowItWorks } from "./HowItWorks";
import { LandingFooter } from "./LandingFooter";
import { LandingHero } from "./LandingHero";
import { PrivacySection } from "./PrivacySection";
import { ScoringSection } from "./ScoringSection";

const COPY: Record<FeatureId, FeatureCopy> = {
  F1: {
    headline: "Start from where you really are",
    body: "Drop in your resume and name the role you want. CareerBuddy reads it and pulls out your skills, experience and projects.",
    points: ["PDF, DOCX or plain text, up to 4 MB", "Prefer typing? Paste your resume instead", "Parsed once and kept private to your account"],
  },
  F2: {
    headline: "See the gap, skill by skill",
    body: "Paste real job posts. Skills are normalized (k8s = Kubernetes), weighted by how often they appear and whether they're required, then compared with your resume.",
    points: [
      "A match score you can actually explain",
      "Matched, partial and missing skills, with evidence quotes",
      "Compare up to 5 job descriptions at once",
    ],
  },
  F3: {
    headline: "A learning plan that fits your week",
    body: "Your gaps become a week-by-week plan, ordered by what moves the needle most for the effort, and limited to the hours you actually have.",
    points: ["Ordered by impact × demand ÷ effort", "Curated resources and tasks each week", "A checkpoint at the end of every stage"],
  },
  F4: {
    headline: "Build proof, not just certificates",
    body: "Get 2–4 portfolio projects, each closing several gaps at once, with milestones and a note on how to talk about it in an interview.",
    points: ["Every project maps to your missing skills", "Milestones you can tick off", "A ready-made interview story for each one"],
  },
  F5: {
    headline: "Practice out loud. Get scored fairly.",
    body: "Answer technical, behavioral or system-design questions by voice or text. Each answer is scored against an explicit rubric, with feedback and a model answer.",
    points: [
      "Speak your answer, then edit the transcript before scoring",
      "Per-criterion scores: correctness, depth, communication, structure",
      "Strengths, things to improve, and a model answer",
    ],
  },
  F6: {
    headline: "Progress that steers the plan",
    body: "Check off tasks and log hours. Your self-ratings and interview scores update your skill levels, and the plan rebalances when you fall behind or get ahead.",
    points: ["Hours and wins logged in seconds", "Skill levels that update from real evidence", "Automatic re-plan with a clear diff"],
  },
  F7: {
    headline: "Learn which applications get replies",
    body: "Log where you apply and move each application through its stages. CareerBuddy tracks which kinds of roles reply and tells you where to focus next.",
    points: [
      "One place for every application and status",
      "Response rates by source, role, company size and match band",
      "See whether tailoring your resume actually gets more replies",
      "Silent applications are marked ghosted after 21 days",
      "Targeting advice that holds up on small samples",
    ],
  },
};

// signedIn switches the calls to action from "sign in" to "go to the dashboard".
export function LandingPage({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <main>
      <LandingHero signedIn={signedIn} />
      <AudienceSection />

      <section id="features" className="scroll-mt-20 border-y border-border bg-card/60 py-16 sm:py-20">
        <div className="px-4 sm:px-8 lg:px-12 2xl:px-16">
          <SectionHeading
            eyebrow="Everything in one place"
            title="Seven tools for one career move"
            lead="From your first resume check to the offer, each step feeds the next."
          />
          <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.id}>
                  <a
                    href={`#${f.id.toLowerCase()}`}
                    className="group flex h-full items-start gap-3 rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-soft"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{f.name}</span>
                      <span className="block text-xs text-muted-foreground">{f.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{f.href ? "Live now" : "Coming soon"}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {FEATURES.map((f, i) => (
        <FeatureSection key={f.id} feature={f} copy={COPY[f.id]} index={i} />
      ))}

      <HowItWorks />
      <ScoringSection />
      <PrivacySection />
      <FaqSection />
      <FinalCta signedIn={signedIn} />
      <LandingFooter signedIn={signedIn} />
    </main>
  );
}
