"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SparklesIcon } from "@/components/ui/icons";
import type { ApplicationInsights } from "@/lib/applications/insights";
import { DIMENSION_LABELS, type Dimension } from "@/lib/scoring/applications";
import { apiRequest, pct } from "../labels";

/**
 * Smoothed response rates per segment with counts. Advice is fetched on demand so
 * opening the tab doesn't spend AI quota.
 */
export function ApplicationInsightsView({ version }: { version: number }) {
  const [data, setData] = useState<ApplicationInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adviceBusy, setAdviceBusy] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<ApplicationInsights>("/api/v1/applications/insights")
      .then((d) => !cancelled && setData(d))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [version]);

  async function getAdvice() {
    setAdviceBusy(true);
    setAdviceError(null);
    try {
      setData(await apiRequest<ApplicationInsights>("/api/v1/applications/insights?advice=1"));
    } catch (err) {
      setAdviceError((err as Error).message);
    } finally {
      setAdviceBusy(false);
    }
  }

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading insights…</p>;

  const { stats } = data;
  const o = stats.overall;

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Response rate" value={pct(o.rate)} hint={`${o.responses} of ${o.decided} applications`} />
        <Stat label="Median time to first response" value={o.medianDaysToResponse == null ? "–" : `${o.medianDaysToResponse} days`} />
        <Stat label="Still waiting" value={String(o.pending)} hint={`Under ${stats.ghostDays} days, not counted yet`} />
        <Stat label="Tracked" value={String(o.tracked)} hint="Excludes saved" />
      </div>

      <Card className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Targeting advice</h2>
            <p className="text-sm text-muted-foreground">Written by AI from the numbers below. Correlations, not causes.</p>
          </div>
          <Button size="sm" onClick={getAdvice} disabled={adviceBusy || o.decided < stats.minSample}>
            <SparklesIcon width={16} height={16} />
            {adviceBusy ? "Thinking…" : data.advice ? "Refresh advice" : "Get advice"}
          </Button>
        </div>
        {o.decided < stats.minSample && (
          <Alert tone="info">
            Advice needs at least {stats.minSample} applications with an outcome (you have {o.decided}).
          </Alert>
        )}
        {data.adviceStatus === "not_enough_data" && (
          <Alert tone="info">Not enough data in any segment yet for useful advice.</Alert>
        )}
        {adviceError && <Alert tone="danger">{adviceError}</Alert>}
        {data.advice && (
          <ul className="grid gap-3">
            {data.advice.suggestions.map((s, i) => (
              <li key={i} className="rounded-lg border border-border p-3">
                <p className="font-medium">{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-sm text-muted-foreground">
        Rates are smoothed toward your overall rate so small groups don&apos;t look extreme. A response is any reply
        (screening, interview, offer or rejection); applications under {stats.ghostDays} days old with no reply aren&apos;t
        counted yet. Groups with fewer than {stats.minSample} applications show only their count.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {(Object.keys(DIMENSION_LABELS) as Dimension[]).map((dim) => (
          <Card key={dim}>
            <h3 className="mb-3 font-semibold">By {DIMENSION_LABELS[dim].toLowerCase()}</h3>
            {stats.segments[dim].length === 0 ? (
              <p className="text-sm text-muted-foreground">No applications with this field yet.</p>
            ) : (
              <ul className="grid gap-3">
                {stats.segments[dim].map((s) => (
                  <li key={s.key} className="grid gap-1 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{s.label}</span>
                      <span className="text-muted-foreground">
                        {s.sufficient
                          ? `${pct(s.smoothedRate)} · ${s.responses} of ${s.applications}`
                          : `${s.applications} of ${stats.minSample} needed`}
                      </span>
                    </div>
                    {s.sufficient ? (
                      <>
                        <ProgressBar value={(s.smoothedRate ?? 0) * 100} label={`${s.label} response rate`} />
                        <span className="text-xs text-muted-foreground">
                          {s.vsOverall != null && `${s.vsOverall}× overall`}
                          {s.medianDaysToResponse != null && ` · median ${s.medianDaysToResponse} days to first response`}
                        </span>
                      </>
                    ) : (
                      <ProgressBar value={(s.applications / stats.minSample) * 100} tone="secondary" className="opacity-40" label={`${s.label}: sample size`} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4 sm:p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
