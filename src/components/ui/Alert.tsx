import type { ComponentProps } from "react";
import { cn } from "./cn";

const TONES = {
  info: "border-primary/30 bg-primary-soft text-primary-soft-foreground",
  success: "border-success/30 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  danger: "border-danger/30 bg-danger-soft text-danger",
} as const;

export function Alert({ tone = "info", className, ...props }: ComponentProps<"p"> & { tone?: keyof typeof TONES }) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-lg border px-3 py-2 text-sm", TONES[tone], className)}
      {...props}
    />
  );
}
