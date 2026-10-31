import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** App-window chrome around landing illustrations. Decorative: exposed as one labelled image. */
export function MockFrame({
  title,
  label,
  children,
  className,
}: {
  title: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="img" aria-label={label} className={cn("relative", className)}>
      {/* Soft brand glow behind the window. */}
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
        <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-danger/70" />
          <span className="size-2.5 rounded-full bg-accent/80" />
          <span className="size-2.5 rounded-full bg-success/70" />
          <span className="ml-2 truncate text-xs text-muted-foreground">{title}</span>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
