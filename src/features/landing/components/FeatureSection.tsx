import { Badge } from "@/components/ui/Badge";
import { CheckIcon } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import type { Feature } from "@/features/catalog";
import { FEATURE_VISUALS } from "./FeatureVisuals";

export type FeatureCopy = { headline: string; body: string; points: string[] };

/** One landing section per module: copy on one side, mock UI on the other, alternating. */
export function FeatureSection({ feature, copy, index }: { feature: Feature; copy: FeatureCopy; index: number }) {
  const reverse = index % 2 === 1;
  const Visual = FEATURE_VISUALS[feature.id];
  const Icon = feature.icon;
  return (
    <section
      id={feature.id.toLowerCase()}
      aria-labelledby={`${feature.id}-title`}
      className={cn("scroll-mt-20 py-16 sm:py-24", reverse && "bg-muted/40")}
    >
      <div className="grid items-center gap-10 px-4 sm:px-8 lg:px-12 2xl:px-16 lg:grid-cols-2 lg:gap-16">
        <div className={cn(reverse && "lg:order-2")}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-soft">
              <Icon />
            </span>
            <span className="text-sm font-semibold text-primary">
              {String(index + 1).padStart(2, "0")} · {feature.name}
            </span>
            {feature.href ? <Badge tone="success">Live now</Badge> : <Badge>Coming soon</Badge>}
          </div>
          <h2 id={`${feature.id}-title`} className="mt-5 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {copy.headline}
          </h2>
          <p className="mt-4 text-lg text-pretty text-muted-foreground">{copy.body}</p>
          <ul className="mt-6 grid gap-3">
            {copy.points.map((p) => (
              <li key={p} className="flex gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-secondary-soft text-secondary">
                  <CheckIcon className="size-3.5" strokeWidth={2.5} />
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={cn("mx-auto w-full max-w-md", reverse && "lg:order-1")}>
          <Visual />
        </div>
      </div>
    </section>
  );
}
