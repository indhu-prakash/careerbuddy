import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { ArrowRightIcon, CheckIcon, MicIcon, SparklesIcon } from "@/components/ui/icons";

export function LandingHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="hero-backdrop absolute inset-0 -z-10" />
      <div className="grid items-center gap-12 px-4 pt-14 pb-20 sm:px-8 lg:px-12 2xl:px-16 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:pb-28">
        <div>
          <Badge tone="primary" className="py-1">
            <SparklesIcon className="size-3.5" /> Your AI career coach, built on real job data
          </Badge>
          <h1 className="mt-6 font-display text-4xl leading-[1.08] font-extrabold tracking-tight text-balance sm:text-6xl">
            Pivot your career with a <span className="text-gradient">plan</span>, not a guess.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground sm:text-xl">
            Upload your resume, paste the jobs you want, and see exactly which skills match, which are missing, and how
            to close the gap, then practice the interview out loud.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={signedIn ? "/dashboard" : "/login"} size="lg">
              {signedIn ? "Go to dashboard" : "Get started free"} <ArrowRightIcon className="size-4" />
            </ButtonLink>
            <ButtonLink href="#features" size="lg" variant="outline">
              See what it does
            </ButtonLink>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {["No credit card", "Voice recordings never stored", "Works on your phone"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckIcon className="size-4 text-secondary" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

// Static product collage: match card with a floating interview-score card.
function HeroVisual() {
  const skills = [
    { name: "Python", have: 100, tone: "success" as const },
    { name: "Docker", have: 50, tone: "warning" as const },
    { name: "Kubernetes", have: 8, tone: "danger" as const },
  ];
  return (
    <div role="img" aria-label="Example result: 72 percent match for ML Engineer, and an 84 out of 100 interview score" className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/25 via-transparent to-secondary/25 blur-3xl" />
      <div className="rounded-3xl border border-border bg-card p-6 shadow-lift">
        <div className="flex items-center gap-5">
          <ScoreRing value={72} size={104} label="match" />
          <div>
            <div className="text-sm text-muted-foreground">Target role</div>
            <div className="font-display text-xl font-bold">ML Engineer</div>
            <div className="mt-1 text-sm text-muted-foreground">compared with 3 real job posts</div>
          </div>
        </div>
        <ul className="mt-6 grid gap-4">
          {skills.map((s) => (
            <li key={s.name}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{s.name}</span>
                <Badge tone={s.tone}>{s.tone === "success" ? "Matched" : s.tone === "warning" ? "Partial" : "Missing"}</Badge>
              </div>
              <ProgressBar value={s.have} tone={s.tone} className="mt-2 h-2" />
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-xl bg-muted p-3 text-sm">
          <span className="font-semibold">Next step:</span> <span className="text-muted-foreground">2 weeks of Kubernetes basics, then deploy your churn model.</span>
        </div>
      </div>

      <div className="absolute -right-2 -bottom-8 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lift sm:-right-8">
        <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground">
          <MicIcon className="size-5" />
        </span>
        <div>
          <div className="text-xs text-muted-foreground">Mock interview</div>
          <div className="font-display text-lg font-bold">
            84<span className="text-sm text-muted-foreground">/100</span>
          </div>
        </div>
      </div>
    </div>
  );
}
