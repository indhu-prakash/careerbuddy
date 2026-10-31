import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { BriefcaseIcon, TargetIcon, TrendingUpIcon } from "@/components/ui/icons";

const AUDIENCES = [
  {
    icon: TrendingUpIcon,
    title: "Career switchers",
    body: "Moving from support to DevOps, or from analytics to ML? See which of your skills transfer and what's genuinely new.",
  },
  {
    icon: TargetIcon,
    title: "Students and new graduates",
    body: "Turn coursework into a job-ready profile: learn what real job posts ask for and build projects that prove it.",
  },
  {
    icon: BriefcaseIcon,
    title: "Professionals moving up",
    body: "Aiming for senior, lead or a new specialism? Measure the gap against the roles you want, not a generic checklist.",
  },
];

export function AudienceSection() {
  return (
    <section id="who-its-for" className="scroll-mt-20 py-16 sm:py-20">
      <div className="px-4 sm:px-8 lg:px-12 2xl:px-16">
        <SectionHeading
          eyebrow="Who it's for"
          title="For anyone heading into a new role"
          lead="Most people don't know how well their resume fits, what to learn first, or which applications are worth sending. CareerBuddy answers all three from your own data."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {AUDIENCES.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
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
