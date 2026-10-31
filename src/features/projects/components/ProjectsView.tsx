"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { BriefcaseIcon, CheckIcon, SparklesIcon } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { apiJson, type Project, type ProjectList } from "@/features/plan/types";

const TIER_TONE: Record<Project["tier"], Tone> = {
  beginner: "success",
  intermediate: "primary",
  advanced: "secondary",
  production: "accent",
};
const STATUS_LABEL: Record<Project["status"], string> = {
  suggested: "Suggested",
  in_progress: "In progress",
  done: "Done",
  dropped: "Dropped",
};

type SuggestResult = ProjectList & { planId: string | null; unplacedMilestones: { projectId: string; title: string }[] };

export function ProjectsView({
  initial,
  planId,
  hasAnalysis,
}: {
  initial: ProjectList;
  planId: string | null;
  hasAnalysis: boolean;
}) {
  const [data, setData] = useState(initial);
  const [unplaced, setUnplaced] = useState<SuggestResult["unplacedMilestones"]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasAnalysis) {
    return (
      <Card className="mt-6 grid gap-3">
        <p>Projects are picked to close your skill gaps. Run a skill-gap analysis first.</p>
        <ButtonLink href="/analyze" className="justify-self-start">
          Analyze my resume
        </ButtonLink>
      </Card>
    );
  }

  async function suggest() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiJson<SuggestResult>("/api/v1/projects/suggest", {
        method: "POST",
        body: JSON.stringify({ gapAnalysisId: data.gapAnalysisId ?? undefined, planId: planId ?? undefined }),
      });
      setData(result);
      setUnplaced(result.unplacedMilestones);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const visible = data.projects.filter((p) => p.status !== "dropped");
  const dropped = data.projects.filter((p) => p.status === "dropped");
  const replaceable = data.projects.some((p) => p.status === "suggested");

  return (
    <div className="mt-6 grid gap-6">
      <Card className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          The AI proposes several ideas; 2–4 are picked so that together they cover your biggest gaps.
          {planId
            ? " Their milestones are added to your learning plan."
            : " Create a learning plan first to have milestones scheduled into your weeks."}
          {replaceable && " Suggesting again replaces projects you haven't started."}
        </p>
        <div className="grid gap-2 sm:flex sm:items-center sm:gap-4">
          <Button onClick={suggest} disabled={busy}>
            <SparklesIcon className="size-4" />
            {busy ? "Generating ideas… (up to a minute)" : data.projects.length ? "Suggest again" : "Suggest projects"}
          </Button>
          {!planId && (
            <ButtonLink href="/plan" variant="outline">
              Create a plan
            </ButtonLink>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
        {unplaced.length > 0 && (
          <Alert tone="warning">
            {unplaced.length} milestone{unplaced.length > 1 ? "s" : ""} didn&apos;t fit in your plan&apos;s weekly hours:{" "}
            {unplaced.map((u) => u.title).join("; ")}.
          </Alert>
        )}
      </Card>

      {data.projects.length > 0 && <CoverageTable data={data} projects={visible} />}

      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            onChange={(updated) =>
              setData((d) => ({ ...d, projects: d.projects.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)) }))
            }
          />
        ))}
      </div>
      {dropped.length > 0 && (
        <p className="text-sm text-muted-foreground">Dropped: {dropped.map((p) => p.title).join(", ")}</p>
      )}
    </div>
  );
}

function CoverageTable({ data, projects }: { data: ProjectList; projects: Project[] }) {
  const uncovered = data.coverage.filter((c) => !c.projectIds.some((id) => projects.some((p) => p.id === id)));
  return (
    <Card className="grid gap-3">
      <h2 className="font-semibold">Top-gap coverage</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1.5 pr-3 font-medium">Gap</th>
              {projects.map((p, i) => (
                <th key={p.id} className="px-2 py-1.5 text-center font-medium" title={p.title}>
                  P{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.coverage.map((c) => (
              <tr key={c.skillKey}>
                <td className="py-1.5 pr-3">{c.name}</td>
                {projects.map((p) => (
                  <td key={p.id} className="px-2 py-1.5 text-center">
                    {c.projectIds.includes(p.id) ? (
                      <CheckIcon className="inline size-4 text-success" aria-label="covered" />
                    ) : (
                      <span className="text-muted-foreground">·</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {projects.map((p, i) => `P${i + 1}: ${p.title}`).join(" · ")}
      </p>
      {uncovered.length > 0 ? (
        <Alert tone="danger">Not covered by any project: {uncovered.map((c) => c.name).join(", ")}.</Alert>
      ) : (
        <Alert tone="success">Every top gap is covered by at least one project.</Alert>
      )}
    </Card>
  );
}

function ProjectCard({ project, onChange }: { project: Project; onChange: (p: Partial<Project> & { id: string }) => void }) {
  const [repoUrl, setRepoUrl] = useState(project.repoUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spec = project.spec;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiJson<Project>(`/api/v1/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="grid content-start gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-semibold">
            <BriefcaseIcon className="size-4 shrink-0 text-primary" /> {project.title}
          </h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone={TIER_TONE[project.tier]}>{project.tier}</Badge>
            {project.skills.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
        </div>
        <Select
          aria-label="Project status"
          className="h-9 w-36 py-1 text-sm"
          value={project.status}
          disabled={busy}
          onChange={(e) => patch({ status: e.target.value })}
        >
          {Object.entries(STATUS_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-sm">{project.description}</p>

      {spec && (
        <>
          <div className="text-sm">
            <p className="font-medium">Milestones</p>
            <ol className="mt-1 grid gap-1">
              {spec.milestones.map((m, i) => (
                <li key={i} className="flex flex-wrap gap-x-2">
                  <span>
                    {i + 1}. {m.title}
                  </span>
                  <span className={cn("text-xs", m.weekNumber ? "text-muted-foreground" : "text-warning")}>
                    {m.weekNumber ? `week ${m.weekNumber} · ${m.estHours} h` : "not scheduled"}
                  </span>
                  <span className="w-full pl-4 text-xs text-muted-foreground">{m.deliverable}</span>
                </li>
              ))}
            </ol>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Spec and talking points</summary>
            <dl className="mt-2 grid gap-2">
              <SpecItem label="Scope">{spec.scope}</SpecItem>
              <SpecItem label="Architecture">{spec.architecture}</SpecItem>
              <SpecItem label="Testing">{spec.testing}</SpecItem>
              <SpecItem label="Deployment">{spec.deployment}</SpecItem>
              <SpecItem label="Deliverables">
                <ul className="list-disc pl-5">
                  {spec.deliverables.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </SpecItem>
              {project.talkingPoints && (
                <SpecItem label="How to talk about it (STAR)">
                  <p className="whitespace-pre-line">{project.talkingPoints}</p>
                </SpecItem>
              )}
            </dl>
          </details>
        </>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          patch({ repoUrl: repoUrl.trim() || null });
        }}
      >
        <Input
          type="url"
          placeholder="https://github.com/you/project"
          aria-label="Repository URL"
          className="h-9 py-1 text-sm"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
        />
        <Button type="submit" variant="outline" size="sm" disabled={busy || repoUrl.trim() === (project.repoUrl ?? "")}>
          Save
        </Button>
      </form>
      {error && <Alert tone="danger">{error}</Alert>}
    </Card>
  );
}

function SpecItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-medium">{label}</dt>
      <dd className="text-muted-foreground">{children}</dd>
    </div>
  );
}
