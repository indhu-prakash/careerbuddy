import Link from "next/link";
import { Badge, type Tone } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { CheckIcon } from "@/components/ui/icons";
import { STATUS_LABEL, type JourneyStage } from "../types";

const TONE: Record<JourneyStage["status"], Tone> = {
  done: "success",
  in_progress: "primary",
  next: "accent",
  locked: "neutral",
};

const DOT: Record<JourneyStage["status"], string> = {
  done: "border-success bg-success text-white dark:text-background",
  in_progress: "border-primary bg-primary-soft text-primary-soft-foreground",
  next: "border-accent bg-card text-accent-soft-foreground",
  locked: "border-border bg-muted text-muted-foreground",
};

/**
 * End-to-end journey: a vertical list on phones, a horizontal stepper from lg up.
 * Each stage links to its page; the next best action is ringed and marked aria-current.
 */
export function JourneyStepper({ stages, nextKey }: { stages: JourneyStage[]; nextKey: string | null }) {
  return (
    <ol aria-label="Career journey" className="grid lg:grid-cols-7">
      {stages.map((s, i) => {
        const isNext = s.key === nextKey;
        const last = i === stages.length - 1;
        return (
          <li key={s.key} aria-current={isNext ? "step" : undefined} className="relative flex gap-3 pb-5 last:pb-0 lg:flex-col lg:items-center lg:pb-0">
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-11 bottom-1 left-[1.25rem] w-0.5 -translate-x-1/2",
                  "lg:top-[1.375rem] lg:bottom-auto lg:left-[calc(50%+1.25rem)] lg:h-0.5 lg:w-[calc(100%-2.5rem)] lg:translate-x-0",
                  s.status === "done" ? "bg-success" : "bg-border",
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-0.5 grid size-10 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold",
                DOT[s.status],
                isNext && "ring-4 ring-primary/30",
              )}
            >
              {s.status === "done" ? <CheckIcon className="size-5" /> : i + 1}
            </span>
            <Link
              href={s.href}
              className={cn(
                "group -m-1 min-w-0 flex-1 rounded-lg p-1 lg:mt-2 lg:w-full lg:text-center",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              )}
              aria-label={`${s.title}: ${STATUS_LABEL[s.status]}. ${s.metric}${isNext ? ". Next best action" : ""}`}
            >
              <span className="flex flex-wrap items-center gap-2 lg:justify-center">
                <span className={cn("font-semibold group-hover:text-primary", s.status === "locked" && "text-muted-foreground")}>
                  {s.title}
                </span>
                <Badge tone={TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
              </span>
              <span className="mt-1 block text-sm break-words text-muted-foreground">{s.metric}</span>
              {isNext && (
                <span className="mt-1.5 inline-block rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  Next best action
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
