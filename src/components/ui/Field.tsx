import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

// text-base (16px) stops iOS Safari zooming in when a field is focused.
export const fieldClasses = cn(
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground",
  "placeholder:text-muted-foreground/70 transition-colors",
  "focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20",
);

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClasses, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClasses, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClasses, className)} {...props} />;
}

/** Label wrapping a control, with an optional hint under it. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    // content-start: a taller neighbour in the same grid row must not stretch the label/control apart.
    <label className="grid content-start gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
