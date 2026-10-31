// Application-tracker stats (F7). Pure: applications in, segment response rates out.
// The LLM only phrases advice from these numbers; it never computes them.

export type AppStatus =
  | "saved"
  | "applied"
  | "screening"
  | "interviewing"
  | "offer"
  | "rejected"
  | "ghosted"
  | "withdrawn";

export const APPLICATION_STATUSES: AppStatus[] = [
  "saved",
  "applied",
  "screening",
  "interviewing",
  "offer",
  "rejected",
  "ghosted",
  "withdrawn",
];

// A reply from the company, good or bad. Reaching any of these means "responded".
export const RESPONSE_STAGES: AppStatus[] = ["screening", "interviewing", "offer", "rejected"];

// Still waiting on the company, so silence can turn into "ghosted".
export const GHOSTABLE_STAGES: AppStatus[] = ["applied", "screening", "interviewing"];

export const MIN_SAMPLE = 5;
export const PRIOR_STRENGTH = 5; // k: the prior counts like 5 applications at the overall rate
export const DEFAULT_GHOST_DAYS = 21;

const DAY_MS = 86_400_000;

export function ghostDays(env: string | undefined = process.env.APPLICATION_GHOST_DAYS): number {
  const n = Number(env);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_GHOST_DAYS;
}

export type MatchBand = "below_50" | "50_70" | "above_70";

export const MATCH_BAND_LABELS: Record<MatchBand, string> = {
  below_50: "Match below 50%",
  "50_70": "Match 50–70%",
  above_70: "Match above 70%",
};

/** matchScore is 0..1 (as stored by the gap analysis). 50% and 70% fall in the middle band. */
export function matchBand(score: number | null | undefined): MatchBand | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score < 0.5) return "below_50";
  if (score <= 0.7) return "50_70";
  return "above_70";
}

/** Beta-smoothed rate: shrinks small segments toward the overall rate, so 1 of 1 isn't 100%. */
export function smoothedRate(responses: number, total: number, overallRate: number, k = PRIOR_STRENGTH): number {
  const p = Math.min(1, Math.max(0, overallRate));
  const a = k * p;
  const b = k * (1 - p);
  return total + a + b === 0 ? 0 : (responses + a) / (total + a + b);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Auto-ghost rule: an application still waiting on the company with no activity
 * (last event, or the apply date if there are none) for `days` days.
 */
export function shouldGhost(
  app: { status: AppStatus; appliedAt: Date; lastEventAt?: Date | null },
  now: Date,
  days = DEFAULT_GHOST_DAYS,
): boolean {
  if (!GHOSTABLE_STAGES.includes(app.status)) return false;
  const last = Math.max(app.appliedAt.getTime(), app.lastEventAt?.getTime() ?? 0);
  return now.getTime() - last >= days * DAY_MS;
}

export type StatsApplication = {
  status: AppStatus;
  appliedAt: Date;
  respondedAt: Date | null;
  roleFamily: string | null;
  seniority: string | null;
  source: string | null;
  industry: string | null;
  companySize: string | null;
  tailored: boolean;
  matchScore: number | null;
};

export type Outcome = "responded" | "no_response" | "pending" | "excluded";

/**
 * Whether an application counts toward response rates. Recent silent applications are
 * "pending" (too early to call), and silent withdrawals/saved ones are left out, so they
 * don't drag the rate down.
 */
export function outcomeOf(app: StatsApplication, now: Date, days = DEFAULT_GHOST_DAYS): Outcome {
  if (app.status === "saved") return "excluded";
  if (app.respondedAt || RESPONSE_STAGES.includes(app.status)) return "responded";
  if (app.status === "withdrawn") return "excluded";
  if (app.status === "ghosted") return "no_response";
  return now.getTime() - app.appliedAt.getTime() >= days * DAY_MS ? "no_response" : "pending";
}

export type Dimension =
  | "roleFamily"
  | "seniority"
  | "source"
  | "industry"
  | "companySize"
  | "tailored"
  | "matchBand";

export const DIMENSION_LABELS: Record<Dimension, string> = {
  roleFamily: "Role family",
  seniority: "Seniority",
  source: "Source",
  industry: "Industry",
  companySize: "Company size",
  tailored: "Tailored resume",
  matchBand: "Match score",
};

export const SOURCE_LABELS: Record<string, string> = {
  referral: "Referral",
  job_board: "Job board",
  company_site: "Company site",
  recruiter: "Recruiter",
  other: "Other",
};

export const COMPANY_SIZE_LABELS: Record<string, string> = {
  startup: "Startup",
  mid: "Mid-size",
  enterprise: "Enterprise",
};

export type SegmentStat = {
  dimension: Dimension;
  key: string;
  label: string;
  applications: number; // decided applications (responded + no response)
  responses: number;
  sufficient: boolean; // applications >= MIN_SAMPLE; rates are null otherwise
  rawRate: number | null;
  smoothedRate: number | null;
  vsOverall: number | null; // smoothedRate / overallRate, e.g. 1.8 = 1.8× the overall rate
  medianDaysToResponse: number | null;
};

export type ApplicationStats = {
  overall: {
    tracked: number; // everything except saved
    decided: number;
    responses: number;
    pending: number;
    rate: number | null;
    medianDaysToResponse: number | null;
  };
  segments: Record<Dimension, SegmentStat[]>;
  minSample: number;
  ghostDays: number;
};

function segmentKey(app: StatsApplication, dim: Dimension): { key: string; label: string } | null {
  if (dim === "matchBand") {
    const band = matchBand(app.matchScore);
    return band ? { key: band, label: MATCH_BAND_LABELS[band] } : null;
  }
  if (dim === "tailored") {
    return app.tailored ? { key: "yes", label: "Tailored" } : { key: "no", label: "Not tailored" };
  }
  const raw = app[dim]?.trim();
  if (!raw) return null;
  if (dim === "source") return { key: raw, label: SOURCE_LABELS[raw] ?? raw };
  if (dim === "companySize") return { key: raw, label: COMPANY_SIZE_LABELS[raw] ?? raw };
  // Free-text fields: group case-insensitively, display the first spelling seen.
  return { key: raw.toLowerCase(), label: raw };
}

function daysToResponse(app: StatsApplication): number | null {
  if (!app.respondedAt) return null;
  return Math.max(0, (app.respondedAt.getTime() - app.appliedAt.getTime()) / DAY_MS);
}

const round = (n: number, digits = 3) => Math.round(n * 10 ** digits) / 10 ** digits;

export function computeApplicationStats(
  apps: StatsApplication[],
  now = new Date(),
  days = DEFAULT_GHOST_DAYS,
): ApplicationStats {
  const withOutcome = apps.map((app) => ({ app, outcome: outcomeOf(app, now, days) }));
  const decided = withOutcome.filter((x) => x.outcome === "responded" || x.outcome === "no_response");
  const responses = decided.filter((x) => x.outcome === "responded").length;
  const overallRate = decided.length ? responses / decided.length : null;
  const allDays = decided.map((x) => daysToResponse(x.app)).filter((d): d is number => d != null);

  const segments = {} as Record<Dimension, SegmentStat[]>;
  for (const dim of Object.keys(DIMENSION_LABELS) as Dimension[]) {
    const groups = new Map<string, { label: string; n: number; responses: number; days: number[] }>();
    for (const { app, outcome } of decided) {
      const seg = segmentKey(app, dim);
      if (!seg) continue;
      const g = groups.get(seg.key) ?? { label: seg.label, n: 0, responses: 0, days: [] };
      g.n += 1;
      if (outcome === "responded") {
        g.responses += 1;
        const d = daysToResponse(app);
        if (d != null) g.days.push(d);
      }
      groups.set(seg.key, g);
    }
    segments[dim] = [...groups.entries()]
      .map(([key, g]): SegmentStat => {
        const sufficient = g.n >= MIN_SAMPLE && overallRate != null;
        const smoothed = sufficient ? smoothedRate(g.responses, g.n, overallRate) : null;
        const med = sufficient ? median(g.days) : null;
        return {
          dimension: dim,
          key,
          label: g.label,
          applications: g.n,
          responses: g.responses,
          sufficient,
          rawRate: sufficient ? round(g.responses / g.n) : null,
          smoothedRate: smoothed == null ? null : round(smoothed),
          vsOverall: smoothed != null && overallRate ? round(smoothed / overallRate, 1) : null,
          medianDaysToResponse: med == null ? null : round(med, 1),
        };
      })
      .sort(
        (x, y) =>
          Number(y.sufficient) - Number(x.sufficient) ||
          (y.smoothedRate ?? 0) - (x.smoothedRate ?? 0) ||
          y.applications - x.applications,
      );
  }

  const med = median(allDays);
  return {
    overall: {
      tracked: apps.filter((a) => a.status !== "saved").length,
      decided: decided.length,
      responses,
      pending: withOutcome.filter((x) => x.outcome === "pending").length,
      rate: overallRate == null ? null : round(overallRate),
      medianDaysToResponse: med == null ? null : round(med, 1),
    },
    segments,
    minSample: MIN_SAMPLE,
    ghostDays: days,
  };
}
