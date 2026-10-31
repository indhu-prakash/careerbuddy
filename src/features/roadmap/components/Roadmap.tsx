"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ArrowRightIcon, SparklesIcon } from "@/components/ui/icons";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { describeStep, type BuildStep, type RoadmapData } from "../types";
import { JourneyStepper } from "./JourneyStepper";
import { PlanTimeline } from "./PlanTimeline";

const STEP_LABEL: Record<string, string> = { plan: "learning plan", projects: "project suggestions" };

/** Roadmap page body: journey stepper, next best action + build button, plan timeline. */
export function Roadmap({ data }: { data: RoadmapData }) {
  const router = useRouter();
  const [building, setBuilding] = useState(false);
  const [steps, setSteps] = useState<BuildStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function build() {
    setBuilding(true);
    setError(null);
    setSteps(null);
    try {
      const res = await fetch("/api/v1/roadmap/build", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error === "unauthorized" ? "Your session expired. Sign in again." : "Something went wrong. Try again.");
      }
      setSteps(json.steps as BuildStep[]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBuilding(false);
    }
  }

  const next = data.nextAction;
  const canBuild = data.automatable.length > 0;
  const failed = steps?.some((s) => s.outcome === "failed");

  return (
    <div className="grid gap-8">
      <section aria-labelledby="journey-heading" className="grid gap-4">
        <h2 id="journey-heading" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Your journey
        </h2>
        <Card>
          <JourneyStepper stages={data.stages} nextKey={next?.stage ?? null} />
        </Card>
      </section>

      <section aria-labelledby="next-heading" className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <Card className="grid gap-4 border-primary/40">
          <div>
            <h2 id="next-heading" className="text-sm font-semibold text-primary">
              Next best action
            </h2>
            {next ? (
              <p className="mt-1 font-display text-xl font-bold">{next.action}</p>
            ) : (
              <p className="mt-1 font-display text-xl font-bold">You&apos;re job-ready. Keep applying!</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {canBuild
                ? `"Build my roadmap" can create your ${data.automatable.map((k) => STEP_LABEL[k] ?? k).join(" and ")} in one click.`
                : next
                  ? "This step needs you. Open it to continue; the roadmap updates automatically from your saved progress."
                  : "Every stage is complete."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {canBuild && (
              <Button onClick={build} disabled={building} aria-busy={building}>
                <SparklesIcon className="size-4" />
                {building ? "Building… up to a minute or two" : "Build my roadmap"}
              </Button>
            )}
            {next && !(canBuild && next.automatable) && (
              <ButtonLink href={next.href} variant={canBuild ? "outline" : "primary"}>
                Go to {next.title.toLowerCase()} <ArrowRightIcon className="size-4" />
              </ButtonLink>
            )}
          </div>
          <div aria-live="polite" className="grid gap-2 empty:hidden">
            {building && (
              <Alert tone="info">Creating your plan and project ideas. This can take up to a minute or two; keep this page open.</Alert>
            )}
            {error && <Alert tone="danger">{error}</Alert>}
            {steps && (
              <Alert tone={failed ? "warning" : "success"}>
                {steps.map((s) => (
                  <span key={s.step} className="block">
                    {describeStep(s)}
                  </span>
                ))}
              </Alert>
            )}
          </div>
        </Card>
        {data.readiness !== null && (
          <Card className="flex items-center gap-4 lg:flex-col lg:justify-center">
            <ScoreRing value={data.readiness * 100} size={96} label="ready" />
            <div className="text-sm lg:text-center">
              <div className="font-semibold">Readiness</div>
              <div className="text-muted-foreground">{data.targetRole ? `for ${data.targetRole}` : "goal 80%"}</div>
            </div>
          </Card>
        )}
      </section>

      <section aria-labelledby="timeline-heading" className="grid gap-4">
        <h2 id="timeline-heading" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Plan timeline
        </h2>
        {data.plan ? (
          <PlanTimeline plan={data.plan} />
        ) : (
          <Card className="grid gap-3 text-center sm:py-10">
            <p className="font-semibold">No active learning plan yet</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {data.automatable.includes("plan")
                ? "Your gap map is ready. Use “Build my roadmap” above to schedule a week-by-week plan."
                : "A plan is scheduled from your skill gaps. Map your gaps first by analyzing a few job descriptions."}
            </p>
            {!data.automatable.includes("plan") && (
              <div>
                <ButtonLink href="/gap-map" variant="outline">
                  Open gap map <ArrowRightIcon className="size-4" />
                </ButtonLink>
              </div>
            )}
          </Card>
        )}
      </section>
    </div>
  );
}
