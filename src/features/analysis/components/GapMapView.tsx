"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GapAnalysisView } from "@/lib/analysis/view";
import { Alert } from "@/components/ui/Alert";
import { Badge, type Tone } from "@/components/ui/Badge";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScoreRing } from "@/components/ui/ScoreRing";

// Dates arrive as strings over JSON.
export type GapMapData = Omit<GapAnalysisView, "createdAt"> & { createdAt: string | Date };

const STATUS = {
  matched: { title: "Matched", tone: "success" },
  partial: { title: "Partial", tone: "warning" },
  missing: { title: "Missing", tone: "danger" },
} as const;

const CATEGORY: Record<string, { label: string; tone: Tone }> = {
  must_have: { label: "Must-have", tone: "primary" },
  good_to_have: { label: "Good to have", tone: "neutral" },
  advanced: { label: "Advanced", tone: "secondary" },
  domain: { label: "Domain", tone: "accent" },
};

const LEVELS = ["None", "Beginner", "Intermediate", "Advanced", "Expert"];

export function GapMapView({ data }: { data: GapMapData }) {
  const pct = Math.round(data.matchScore * 100);
  const top = data.gaps.slice(0, 8);
  const radar = data.gaps
    .slice()
    .sort((a, b) => b.demand - a.demand)
    .slice(0, 8)
    .map((g) => ({ skill: g.skill, you: g.currentLevel ?? 0, required: g.requiredLevel ?? 2 }));

  return (
    <Card className="grid gap-6 print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-center gap-5 sm:gap-8">
        <ScoreRing value={pct} size={104} label="match" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl font-bold">
            Match score{data.targetRole ? ` for ${data.targetRole.title}` : ""}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[
              data.candidate?.currentRole,
              data.candidate?.yearsExperience != null ? `${data.candidate.yearsExperience} yrs` : null,
              `${data.jdCount} job description${data.jdCount === 1 ? "" : "s"}`,
              new Date(data.createdAt).toLocaleDateString(),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {data.jobDescriptions.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {data.jobDescriptions
                .map((jd) => [jd.title, jd.company].filter(Boolean).join(" @ ") || "Untitled JD")
                .join(", ")}
            </p>
          )}
        </div>
        <div className="flex gap-2 print:hidden">
          <ButtonLink href={`/api/v1/analyses/${data.id}/export`} variant="outline" size="sm">
            Excel
          </ButtonLink>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            PDF / print
          </Button>
        </div>
      </div>

      {data.usedTemplate && (
        <Alert tone="info">
          Fewer than 3 job descriptions, so demand is blended with the
          {data.targetRole?.roleTrack ? ` ${data.targetRole.roleTrack.title}` : ""} role template. Skills marked
          “template” come from it rather than a JD. Add more JDs for a market-based map.
        </Alert>
      )}

      {data.gaps.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Your level vs required (top skills by demand)">
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radar} outerRadius="70%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 4]} tickCount={5} tick={false} axisLine={false} />
                <Radar name="Required" dataKey="required" stroke="var(--secondary)" fill="var(--secondary)" fillOpacity={0.15} />
                <Radar name="You" dataKey="you" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.35} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => LEVELS[Number(v)] ?? v} contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Biggest gaps: demand vs what you have">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={top.map((g) => ({ skill: g.skill, demand: pctOf(g.demand), covered: pctOf(g.demand * g.have) }))}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis type="category" dataKey="skill" width={110} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="demand" name="Demand" fill="var(--secondary)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="covered" name="Covered by you" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((status) => {
          const items = data.gaps.filter((g) => g.status === status);
          return (
            <div key={status} className="rounded-xl border border-border p-3">
              <h3 className="flex items-center justify-between font-semibold">
                {STATUS[status].title}
                <Badge tone={STATUS[status].tone}>{items.length}</Badge>
              </h3>
              <ul className="mt-2 grid gap-3 text-sm">
                {items.map((g) => (
                  <li key={`${g.skill}-${g.skillId}`} className="grid gap-1">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-medium">{g.skill}</span>
                      <span className="text-xs text-muted-foreground">{pctOf(g.demand)}% demand</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {g.category && <Badge tone={CATEGORY[g.category].tone}>{CATEGORY[g.category].label}</Badge>}
                      {g.fromTemplate && <Badge>template</Badge>}
                      {!g.curated && <Badge tone="warning" title="Not in the skill catalog yet">unreviewed</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      You: {LEVELS[g.currentLevel ?? 0]} · Needed: {LEVELS[g.requiredLevel ?? 2]}
                      {g.gap > 0 && g.effortHours ? ` · ~${g.effortHours} h` : ""}
                    </p>
                    {g.evidence && <p className="text-muted-foreground italic">Resume: “{g.evidence}”</p>}
                    {g.jdQuotes.slice(0, 1).map((q) => (
                      <p key={q} className="text-muted-foreground italic">
                        JD: “{q}”
                      </p>
                    ))}
                  </li>
                ))}
                {items.length === 0 && <li className="text-muted-foreground">None</li>}
              </ul>
            </div>
          );
        })}
      </div>

      {data.recommendations.length > 0 && (
        <div>
          <h3 className="font-semibold">Next steps</h3>
          <ol className="mt-2 list-decimal pl-5 text-sm text-muted-foreground marker:text-primary">
            {data.recommendations.map((r) => (
              <li key={r} className="mt-1">
                {r}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row print:hidden">
            <ButtonLink href={`/plan?analysis=${data.id}`}>Build my learning plan</ButtonLink>
            <ButtonLink href={`/projects?analysis=${data.id}`} variant="outline">
              Suggest portfolio projects
            </ButtonLink>
          </div>
        </div>
      )}
    </Card>
  );
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function pctOf(x: number) {
  return Math.round(x * 100);
}
