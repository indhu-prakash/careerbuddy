import { describe, expect, it } from "vitest";
import {
  computeApplicationStats,
  ghostDays,
  matchBand,
  median,
  outcomeOf,
  shouldGhost,
  smoothedRate,
  type StatsApplication,
} from "@/lib/scoring/applications";

const NOW = new Date("2026-10-31T00:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

function app(over: Partial<StatsApplication> = {}): StatsApplication {
  return {
    status: "applied",
    appliedAt: daysAgo(60),
    respondedAt: null,
    roleFamily: null,
    seniority: null,
    source: null,
    industry: null,
    companySize: null,
    tailored: false,
    matchScore: null,
    ...over,
  };
}
const responded = (days: number, over: Partial<StatsApplication> = {}) =>
  app({ status: "screening", appliedAt: daysAgo(60), respondedAt: daysAgo(60 - days), ...over });
const silent = (over: Partial<StatsApplication> = {}) => app({ status: "ghosted", ...over });

describe("smoothedRate", () => {
  it("shrinks 1 of 1 toward the overall rate", () => {
    // a = 5 * 0.2 = 1, b = 4 -> (1 + 1) / (1 + 5)
    expect(smoothedRate(1, 1, 0.2)).toBeCloseTo(2 / 6);
    expect(smoothedRate(1, 1, 0.2)).toBeLessThan(0.5);
  });

  it("equals the overall rate with no data and approaches the raw rate with lots", () => {
    expect(smoothedRate(0, 0, 0.3)).toBeCloseTo(0.3);
    expect(smoothedRate(500, 1000, 0.1)).toBeCloseTo(0.498, 2);
  });

  it("handles 0% and 100% overall rates", () => {
    expect(smoothedRate(0, 5, 0)).toBe(0);
    expect(smoothedRate(5, 5, 1)).toBe(1);
  });
});

describe("matchBand", () => {
  it("puts 50% and 70% in the middle band", () => {
    expect(matchBand(0.49)).toBe("below_50");
    expect(matchBand(0.5)).toBe("50_70");
    expect(matchBand(0.7)).toBe("50_70");
    expect(matchBand(0.71)).toBe("above_70");
    expect(matchBand(null)).toBeNull();
    expect(matchBand(Number.NaN)).toBeNull();
  });
});

describe("median", () => {
  it("handles odd, even and empty lists", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("shouldGhost", () => {
  it("ghosts waiting applications with no activity for N days", () => {
    expect(shouldGhost({ status: "applied", appliedAt: daysAgo(21) }, NOW, 21)).toBe(true);
    expect(shouldGhost({ status: "applied", appliedAt: daysAgo(20) }, NOW, 21)).toBe(false);
    expect(shouldGhost({ status: "interviewing", appliedAt: daysAgo(40), lastEventAt: daysAgo(30) }, NOW, 21)).toBe(true);
  });

  it("counts the latest event as activity", () => {
    expect(shouldGhost({ status: "screening", appliedAt: daysAgo(40), lastEventAt: daysAgo(3) }, NOW, 21)).toBe(false);
  });

  it("never ghosts saved or finished applications", () => {
    for (const status of ["saved", "offer", "rejected", "ghosted", "withdrawn"] as const) {
      expect(shouldGhost({ status, appliedAt: daysAgo(100) }, NOW, 21)).toBe(false);
    }
  });

  it("reads the ghost window from env with a default of 21", () => {
    expect(ghostDays(undefined)).toBe(21);
    expect(ghostDays("14")).toBe(14);
    expect(ghostDays("abc")).toBe(21);
    expect(ghostDays("0")).toBe(21);
  });
});

describe("outcomeOf", () => {
  it("classifies responses, silence, pending and excluded applications", () => {
    expect(outcomeOf(app({ status: "rejected" }), NOW)).toBe("responded");
    expect(outcomeOf(app({ status: "ghosted", respondedAt: daysAgo(50) }), NOW)).toBe("responded");
    expect(outcomeOf(app({ status: "ghosted" }), NOW)).toBe("no_response");
    expect(outcomeOf(app({ status: "applied", appliedAt: daysAgo(30) }), NOW)).toBe("no_response");
    expect(outcomeOf(app({ status: "applied", appliedAt: daysAgo(3) }), NOW)).toBe("pending");
    expect(outcomeOf(app({ status: "saved" }), NOW)).toBe("excluded");
    expect(outcomeOf(app({ status: "withdrawn" }), NOW)).toBe("excluded");
  });
});

describe("computeApplicationStats", () => {
  // 6 referrals (4 responded), 6 job-board (1 responded), 2 recruiter (2 responded).
  const apps: StatsApplication[] = [
    ...[2, 4, 6, 8].map((d) => responded(d, { source: "referral", matchScore: 0.8, roleFamily: "Data" })),
    silent({ source: "referral", matchScore: 0.75, roleFamily: "data" }),
    silent({ source: "referral", matchScore: 0.6 }),
    responded(20, { source: "job_board", matchScore: 0.4 }),
    ...Array.from({ length: 5 }, () => silent({ source: "job_board", matchScore: 0.3 })),
    responded(1, { source: "recruiter" }),
    responded(3, { source: "recruiter" }),
    app({ status: "applied", appliedAt: daysAgo(2), source: "referral" }), // pending
    app({ status: "saved", source: "referral" }), // excluded
  ];
  const stats = computeApplicationStats(apps, NOW, 21);
  const bySource = Object.fromEntries(stats.segments.source.map((s) => [s.key, s]));

  it("computes the overall rate from decided applications only", () => {
    expect(stats.overall).toMatchObject({ tracked: 15, decided: 14, responses: 7, pending: 1, rate: 0.5 });
    // days to response: 2,4,6,8,20,1,3 -> median 4
    expect(stats.overall.medianDaysToResponse).toBe(4);
  });

  it("smooths segment rates with the overall-rate prior", () => {
    const referral = bySource.referral;
    expect(referral).toMatchObject({ applications: 6, responses: 4, sufficient: true, rawRate: 0.667 });
    // (4 + 2.5) / (6 + 5)
    expect(referral.smoothedRate).toBeCloseTo(6.5 / 11, 3);
    expect(referral.vsOverall).toBe(1.2);
    expect(referral.medianDaysToResponse).toBe(5);
    expect(bySource.job_board.smoothedRate).toBeCloseTo(3.5 / 11, 3);
    expect(bySource.referral.label).toBe("Referral");
  });

  it("hides rates under the minimum sample but keeps the count", () => {
    expect(bySource.recruiter).toMatchObject({
      applications: 2,
      responses: 2,
      sufficient: false,
      rawRate: null,
      smoothedRate: null,
      medianDaysToResponse: null,
    });
  });

  it("sorts sufficient segments first, best rate first", () => {
    expect(stats.segments.source.map((s) => s.key)).toEqual(["referral", "job_board", "recruiter"]);
  });

  it("segments by match band and groups free text case-insensitively", () => {
    const bands = Object.fromEntries(stats.segments.matchBand.map((s) => [s.key, s.applications]));
    expect(bands).toEqual({ above_70: 5, "50_70": 1, below_50: 6 });
    expect(stats.segments.roleFamily).toEqual([
      expect.objectContaining({ key: "data", label: "Data", applications: 5, responses: 4 }),
    ]);
    // Unknown values don't form a segment.
    expect(stats.segments.industry).toEqual([]);
  });

  it("segments by tailored resume and company size", () => {
    const s = computeApplicationStats(
      [
        ...[2, 4, 6].map((d) => responded(d, { tailored: true, companySize: "startup" })),
        ...[1, 2].map(() => silent({ tailored: true, companySize: "startup" })),
        ...[1, 2, 3, 4].map(() => silent({ companySize: "enterprise" })),
        responded(5),
      ],
      NOW,
      21,
    );
    const tailored = Object.fromEntries(s.segments.tailored.map((x) => [x.key, x]));
    expect(tailored.yes).toMatchObject({ label: "Tailored", applications: 5, responses: 3, sufficient: true });
    expect(tailored.no).toMatchObject({ label: "Not tailored", applications: 5, responses: 1, sufficient: true });
    expect(tailored.yes.smoothedRate!).toBeGreaterThan(tailored.no.smoothedRate!);
    // Unset company size forms no segment; known values get display labels.
    expect(s.segments.companySize.map((x) => [x.label, x.applications])).toEqual([
      ["Startup", 5],
      ["Enterprise", 4],
    ]);
  });

  it("returns empty stats without applications", () => {
    const empty = computeApplicationStats([], NOW);
    expect(empty.overall).toMatchObject({ decided: 0, rate: null, medianDaysToResponse: null });
    expect(empty.segments.source).toEqual([]);
  });
});
