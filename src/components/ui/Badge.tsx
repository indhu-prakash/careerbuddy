import type { ComponentProps } from "react";
import { cn } from "./cn";

export type Tone = "primary" | "secondary" | "accent" | "success" | "warning" | "danger" | "neutral";

const TONES: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary-soft-foreground",
  secondary: "bg-secondary-soft text-secondary-soft-foreground",
  accent: "bg-accent-soft text-accent-soft-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-muted text-muted-foreground",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[tone], className)}
      {...props}
    />
  );
}
