import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ChartIcon, MicIcon, ShieldIcon } from "@/components/ui/icons";

// Claims here mirror ARCHITECTURE.md / README "Security model"; keep them in sync.
const POINTS = [
  {
    icon: ShieldIcon,
    title: "Your data stays yours",
    body: "Every record is scoped to your account. Resumes live in a private bucket, reachable only through short-lived signed links.",
  },
  {
    icon: MicIcon,
    title: "Audio is never stored",
    body: "Interview recordings are transcribed and dropped. You review and edit the transcript before anything is scored.",
  },
  {
    icon: ChartIcon,
    title: "Scores you can check",
    body: "AI extracts skills and writes feedback. The match and rubric scores are computed in plain code, so they're consistent and explainable.",
  },
];

export function PrivacySection() {
  return (
    <section id="privacy" className="scroll-mt-20 bg-muted/40 py-20 sm:py-28">
      <div className="px-4 sm:px-8 lg:px-12 2xl:px-16">
        <SectionHeading eyebrow="Privacy & trust" title="Built to be trusted with your career" />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <span className="grid size-11 place-items-center rounded-xl bg-secondary-soft text-secondary">
                <Icon />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
              <p className="mt-2 text-muted-foreground">{body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
