import { cn } from "./cn";

/** Circular 0–100 score drawn with the brand gradient. */
export function ScoreRing({
  value,
  size = 96,
  label,
  suffix = "%",
  className,
}: {
  value: number;
  size?: number;
  label?: string;
  suffix?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = Math.max(6, size / 12);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Same-size rings share an identical gradient, so a shared id is safe.
  const gradientId = `score-ring-${size}`;
  return (
    <div className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--primary)" }} />
            <stop offset="100%" style={{ stopColor: "var(--secondary)" }} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <div className="absolute text-center leading-none" role="img" aria-label={`${label ?? "Score"}: ${pct}${suffix}`}>
        <div className="font-display font-bold" style={{ fontSize: size * 0.26 }}>
          {pct}
          <span className="text-muted-foreground" style={{ fontSize: size * 0.13 }}>
            {suffix}
          </span>
        </div>
        {label && <div className="mt-1 text-[10px] tracking-wide text-muted-foreground uppercase">{label}</div>}
      </div>
    </div>
  );
}
