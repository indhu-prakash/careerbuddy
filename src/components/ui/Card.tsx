import type { ComponentProps } from "react";
import { cn } from "./cn";

/** Raised surface for grouped content. `interactive` adds a hover lift for clickable cards. */
export function Card({ className, interactive, ...props }: ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6",
        interactive && "transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lift",
        className,
      )}
      {...props}
    />
  );
}
