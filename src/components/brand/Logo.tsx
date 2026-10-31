import { cn } from "@/components/ui/cn";

/*
 * Logo concepts (see docs/DESIGN_SYSTEM.html §6). Colors come from theme tokens,
 * so every mark adapts to light/dark. "pivot" is the default brand mark.
 *  - pivot:   a path that steps up and turns forward: the career pivot.
 *  - venn:    you + the role; the amber overlap is your match.
 *  - compass: an open "C" with an arrow breaking out north-east.
 *  - steps:   rising bars with a figure on top: progress you can see.
 */
export type LogoVariant = "pivot" | "venn" | "compass" | "steps";

// Gradient ids are shared between instances; every copy defines identical stops.
function BrandGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
      <stop offset="0%" style={{ stopColor: "var(--primary)" }} />
      <stop offset="100%" style={{ stopColor: "var(--secondary)" }} />
    </linearGradient>
  );
}

const MARKS: Record<LogoVariant, React.ReactNode> = {
  pivot: (
    <>
      <defs>
        <BrandGradient id="cb-g-pivot" />
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#cb-g-pivot)" />
      <g fill="none" stroke="var(--primary-foreground)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 28h5a5 5 0 0 0 5-5v-4a5 5 0 0 1 5-5h5" />
        <path d="M26.5 10 30 14l-3.5 4" />
      </g>
      <circle cx="10" cy="28" r="2.6" style={{ fill: "var(--accent)" }} />
    </>
  ),
  venn: (
    <>
      <defs>
        <clipPath id="cb-clip-venn">
          <circle cx="15" cy="20" r="10" />
        </clipPath>
      </defs>
      <circle cx="15" cy="20" r="10" style={{ fill: "var(--primary)" }} />
      <circle cx="25" cy="20" r="10" style={{ fill: "var(--secondary)" }} />
      <circle cx="25" cy="20" r="10" clipPath="url(#cb-clip-venn)" style={{ fill: "var(--accent)" }} />
    </>
  ),
  compass: (
    <>
      <defs>
        <BrandGradient id="cb-g-compass" />
      </defs>
      <g fill="none" stroke="url(#cb-g-compass)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.08 8.18A12 12 0 1 0 31.82 17.92" />
        <path d="M16 24 31 9M23.5 9H31v7.5" />
      </g>
    </>
  ),
  steps: (
    <>
      <defs>
        <BrandGradient id="cb-g-steps" />
      </defs>
      <g fill="url(#cb-g-steps)">
        <rect x="6" y="24" width="7.5" height="10" rx="2.5" />
        <rect x="16.25" y="18" width="7.5" height="16" rx="2.5" />
        <rect x="26.5" y="13" width="7.5" height="21" rx="2.5" />
      </g>
      <circle cx="30.25" cy="7" r="3.2" style={{ fill: "var(--accent)" }} />
    </>
  ),
};

export function LogoMark({ variant = "pivot", size = 32, className }: { variant?: LogoVariant; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
      {MARKS[variant]}
    </svg>
  );
}

/** Mark + "CareerBuddy" wordmark ("Buddy" in the brand gradient). */
export function Logo({ variant = "pivot", size = 32, className }: { variant?: LogoVariant; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark variant={variant} size={size} />
      <span className="font-display font-extrabold tracking-tight" style={{ fontSize: size * 0.6 }}>
        Career<span className="text-gradient">Buddy</span>
      </span>
    </span>
  );
}
