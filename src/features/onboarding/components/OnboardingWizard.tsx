"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { cn } from "@/components/ui/cn";
import { FileDrop } from "@/features/analysis/components/FileDrop";

export type InventorySkill = {
  skillId: string;
  name: string;
  level: number;
  evidenceType: "demonstrated" | "mentioned" | "self_reported" | "assessed";
  confirmedByUser: boolean;
  curated: boolean;
  quote: string | null;
};

export type RoleTrackOption = { slug: string; title: string; family: string };

export type TargetRoleDefaults = {
  title: string;
  seniority: string | null;
  industry: string | null;
  location: string | null;
  salaryExpectation: string | null;
  hoursPerWeek: number | null;
  horizonWeeks: number | null;
  roleTrackSlug: string | null;
};

const LEVELS = ["None", "Beginner", "Intermediate", "Advanced", "Expert"];
const EVIDENCE: Record<InventorySkill["evidenceType"], string> = {
  demonstrated: "used in your work",
  mentioned: "listed only",
  self_reported: "added by you",
  assessed: "assessed",
};
const ERRORS: Record<string, string> = {
  resume_text_too_short: "We couldn't read text from that file (it may be a scanned image). Paste the text instead.",
  unsupported_file_type: "Use a PDF, DOCX or TXT file.",
  file_too_large: "Keep the file under 4 MB.",
  unreadable_file: "We couldn't read that file. Try another format or paste the text.",
  ai_daily_limit: "You've reached today's AI limit. Try again tomorrow.",
  ai_busy: "The AI service is busy right now. Try again in a minute.",
};

const STEPS = ["Resume", "Review skills", "Target role & time"];

export function OnboardingWizard({
  initialSkills,
  hasResume,
  roleTracks,
  defaults,
}: {
  initialSkills: InventorySkill[];
  hasResume: boolean;
  roleTracks: RoleTrackOption[];
  defaults: TargetRoleDefaults;
}) {
  const router = useRouter();
  const [step, setStep] = useState(hasResume ? 1 : 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [file, setFile] = useState<File | null>(null);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState("");

  // Step 2
  const [skills, setSkills] = useState(initialSkills);
  const [removed, setRemoved] = useState<string[]>([]);
  const [edited, setEdited] = useState<Record<string, number>>({});
  const [newSkill, setNewSkill] = useState("");
  const [added, setAdded] = useState<{ name: string; level: number }[]>([]);

  // Step 3
  const [role, setRole] = useState(defaults);

  async function call(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(ERRORS[body.error] ?? "Something went wrong. Try again.");
    return body;
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const submitResume = () =>
    run(async () => {
      const form = new FormData();
      if (paste) form.append("resumeText", text);
      else if (file) form.append("resume", file);
      const body = await call("/api/v1/resumes", { method: "POST", body: form });
      setSkills(body.skills);
      setRemoved([]);
      setEdited({});
      setAdded([]);
      setStep(1);
    });

  const saveSkills = () =>
    run(async () => {
      const body = await call("/api/v1/skills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remove: removed,
          set: [
            ...Object.entries(edited).map(([skillId, level]) => ({ skillId, level })),
            ...added.map((a) => ({ name: a.name, level: a.level })),
          ],
          confirmAll: true,
        }),
      });
      setSkills(body.skills);
      setRemoved([]);
      setEdited({});
      setAdded([]);
      setStep(2);
    });

  const saveRole = () =>
    run(async () => {
      await call("/api/v1/target-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...role, title: role.title.trim() }),
      });
      await call("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarded: true }),
      });
      router.push("/analyze");
      router.refresh();
    });

  const visible = skills.filter((s) => !removed.includes(s.skillId));

  return (
    <div className="mt-6 grid gap-6">
      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              disabled={i > 0 && !hasResume && skills.length === 0}
              onClick={() => setStep(i)}
              className={cn(
                "rounded-full border px-3 py-1",
                i === step ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border text-muted-foreground",
              )}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {error && <Alert tone="danger">{error}</Alert>}

      {step === 0 && (
        <Card className="grid gap-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Your resume</h2>
            <button type="button" onClick={() => setPaste((p) => !p)} className="text-sm font-medium text-primary hover:underline">
              {paste ? "Upload a file instead" : "Paste text instead"}
            </button>
          </div>
          {paste ? (
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} placeholder="Paste your resume here." />
          ) : (
            <FileDrop
              label="Upload resume"
              hint="PDF, DOCX or TXT, up to 4 MB"
              files={file ? [file] : []}
              onFiles={(fs) => setFile(fs[0] ?? null)}
              onRemove={() => setFile(null)}
              tall
            />
          )}
          <p className="text-sm text-muted-foreground">
            The AI reads it once to list your skills with quotes from the text. PDF and DOCX files are kept in private
            storage; use a test resume while free AI models are configured.
          </p>
          <Button onClick={submitResume} disabled={busy || (paste ? text.trim().length === 0 : !file)}>
            {busy ? "Reading your resume… (up to a minute)" : "Continue"}
          </Button>
        </Card>
      )}

      {step === 1 && (
        <Card className="grid gap-4">
          <div>
            <h2 className="font-semibold">Review your skills</h2>
            <p className="text-sm text-muted-foreground">
              Correct the level, remove anything wrong, and add what’s missing. Every later step uses this list.
            </p>
          </div>
          {visible.length === 0 && added.length === 0 && (
            <p className="text-sm text-muted-foreground">No skills yet. Upload a resume or add skills below.</p>
          )}
          <ul className="grid gap-2">
            {visible.map((s) => (
              <li key={s.skillId} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    <Badge tone={s.evidenceType === "demonstrated" || s.evidenceType === "assessed" ? "success" : "neutral"}>
                      {EVIDENCE[s.evidenceType]}
                    </Badge>
                    {s.confirmedByUser && <Badge tone="primary">confirmed</Badge>}
                    {!s.curated && <Badge tone="warning">new to catalog</Badge>}
                  </div>
                  {s.quote && <p className="mt-1 truncate text-sm text-muted-foreground italic">“{s.quote}”</p>}
                </div>
                <Select
                  aria-label={`${s.name} level`}
                  value={edited[s.skillId] ?? s.level}
                  onChange={(e) => setEdited((p) => ({ ...p, [s.skillId]: Number(e.target.value) }))}
                  className="sm:w-40"
                >
                  {LEVELS.map((l, i) => (
                    <option key={l} value={i}>
                      {l}
                    </option>
                  ))}
                </Select>
                <Button variant="ghost" size="sm" onClick={() => setRemoved((p) => [...p, s.skillId])}>
                  Remove
                </Button>
              </li>
            ))}
            {added.map((a, i) => (
              <li key={`new-${a.name}`} className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border p-3">
                <span className="font-medium">
                  {a.name} <Badge>new</Badge>
                </span>
                <div className="flex items-center gap-2">
                  <Select
                    aria-label={`${a.name} level`}
                    value={a.level}
                    onChange={(e) => setAdded((p) => p.map((x, j) => (j === i ? { ...x, level: Number(e.target.value) } : x)))}
                    className="w-40"
                  >
                    {LEVELS.map((l, li) => (
                      <option key={l} value={li}>
                        {l}
                      </option>
                    ))}
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => setAdded((p) => p.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newSkill.trim();
              if (name && !added.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
                setAdded((p) => [...p, { name, level: 2 }]);
              }
              setNewSkill("");
            }}
          >
            <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Add a skill, e.g. Docker" />
            <Button type="submit" variant="outline" size="sm" className="h-auto">
              Add
            </Button>
          </form>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={saveSkills} disabled={busy}>
              {busy ? "Saving…" : "Confirm skills"}
            </Button>
            <Button variant="ghost" onClick={() => setStep(0)}>
              Upload a different resume
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="grid gap-4">
          <h2 className="font-semibold">Target role and time budget</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target role" hint="e.g. AI Engineer, Full Stack Developer, SDE 2">
              <Input value={role.title} onChange={(e) => setRole({ ...role, title: e.target.value })} required />
            </Field>
            <Field label="Role template" hint="Used to fill in skills when you have few job descriptions.">
              <Select
                value={role.roleTrackSlug ?? ""}
                onChange={(e) => setRole({ ...role, roleTrackSlug: e.target.value || null })}
              >
                <option value="">Match automatically from the title</option>
                {roleTracks.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.title} ({t.family})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Seniority">
              <Input value={role.seniority ?? ""} onChange={(e) => setRole({ ...role, seniority: e.target.value || null })} placeholder="e.g. Mid-level" />
            </Field>
            <Field label="Industry">
              <Input value={role.industry ?? ""} onChange={(e) => setRole({ ...role, industry: e.target.value || null })} placeholder="e.g. Fintech" />
            </Field>
            <Field label="Location">
              <Input value={role.location ?? ""} onChange={(e) => setRole({ ...role, location: e.target.value || null })} placeholder="e.g. Bengaluru or Remote" />
            </Field>
            <Field label="Salary expectation">
              <Input
                value={role.salaryExpectation ?? ""}
                onChange={(e) => setRole({ ...role, salaryExpectation: e.target.value || null })}
                placeholder="e.g. ₹18-24 LPA"
              />
            </Field>
            <Field label="Hours you can study per week">
              <Input
                type="number"
                min={1}
                max={80}
                value={role.hoursPerWeek ?? ""}
                onChange={(e) => setRole({ ...role, hoursPerWeek: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            <Field label="Timeline">
              <Select
                value={role.horizonWeeks ?? 8}
                onChange={(e) => setRole({ ...role, horizonWeeks: Number(e.target.value) })}
              >
                {[4, 8, 12, 16].map((w) => (
                  <option key={w} value={w}>
                    {w} weeks
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button onClick={saveRole} disabled={busy || role.title.trim().length < 2 || !role.hoursPerWeek}>
            {busy ? "Saving…" : "Finish and analyze job descriptions"}
          </Button>
        </Card>
      )}
    </div>
  );
}
