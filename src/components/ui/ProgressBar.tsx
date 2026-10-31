import { cn } from "./cn";

const FILLS = {
  brand: "bg-gradient-to-r from-primary to-secondary",
  primary: "bg-primary",
  secondary: "bg-secondary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

/** Horizontal bar for a 0–100 value. */
export function ProgressBar({
  value,
  tone = "brand",
  className,
  label,
}: {
  value: number;
  tone?: keyof typeof FILLS;
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-2.5 overflow-hidden rounded-full bg-muted", className)}
    >
      <div className={cn("h-full rounded-full", FILLS[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
