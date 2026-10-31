"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { SOURCES } from "@/lib/applications/schemas";
import { SOURCE_LABELS } from "@/lib/scoring/applications";
import { apiRequest, pct } from "../labels";
import type { ApplicationRow, LinkOptions } from "../types";

type FormState = {
  jobDescriptionId: string;
  resumeId: string;
  company: string;
  roleTitle: string;
  roleFamily: string;
  seniority: string;
  industry: string;
  companySize: string;
  location: string;
  source: string;
  tailored: boolean;
  appliedAt: string;
  followUpAt: string;
  notes: string;
  status: "applied" | "saved";
};

const today = () => new Date().toISOString().slice(0, 10);

function initialState(app?: ApplicationRow): FormState {
  return {
    jobDescriptionId: app?.jobDescriptionId ?? "",
    resumeId: app?.resumeId ?? "",
    company: app?.company ?? "",
    roleTitle: app?.roleTitle ?? "",
    roleFamily: app?.roleFamily ?? "",
    seniority: app?.seniority ?? "",
    industry: app?.industry ?? "",
    companySize: app?.companySize ?? "",
    location: app?.location ?? "",
    source: app?.source ?? "",
    tailored: app?.tailored ?? false,
    appliedAt: app ? app.appliedAt.slice(0, 10) : today(),
    followUpAt: app?.followUpAt?.slice(0, 10) ?? "",
    notes: app?.notes ?? "",
    status: "applied",
  };
}

/** Create (no `application`) or edit an application. Status changes happen in the detail view. */
export function ApplicationForm({
  application,
  options,
  onSaved,
  onCancel,
}: {
  application?: ApplicationRow;
  options: LinkOptions;
  onSaved: (app: ApplicationRow) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(() => initialState(application));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const linkedJd = options.jobDescriptions.find((j) => j.id === form.jobDescriptionId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      jobDescriptionId: form.jobDescriptionId || null,
      resumeId: form.resumeId || null,
      company: form.company || undefined,
      roleTitle: form.roleTitle || undefined,
      // Empty family on create means "fill in automatically".
      roleFamily: form.roleFamily || (application ? null : undefined),
      seniority: form.seniority || null,
      industry: form.industry || null,
      companySize: form.companySize || null,
      location: form.location || null,
      source: form.source || null,
      referral: form.source === "referral",
      tailored: form.tailored,
      appliedAt: new Date(`${form.appliedAt}T12:00:00`).toISOString(),
      followUpAt: form.followUpAt || null,
      notes: form.notes || null,
      ...(application ? {} : { status: form.status }),
    };
    try {
      const { application: saved } = await apiRequest<{ application: ApplicationRow }>(
        application ? `/api/v1/applications/${application.id}` : "/api/v1/applications",
        { method: application ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Linked job description"
          hint={
            linkedJd
              ? `Match score ${pct(linkedJd.matchScore)} will be saved with this application.`
              : "Link a JD you analysed to fill in match score and role family."
          }
        >
          <Select value={form.jobDescriptionId} onChange={(e) => set("jobDescriptionId", e.target.value)}>
            <option value="">None</option>
            {options.jobDescriptions.map((jd) => (
              <option key={jd.id} value={jd.id}>
                {[jd.title ?? "Untitled JD", jd.company].filter(Boolean).join(" · ")}
                {jd.matchScore != null ? ` (${pct(jd.matchScore)})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Resume version">
          <Select value={form.resumeId} onChange={(e) => set("resumeId", e.target.value)}>
            <option value="">None</option>
            {options.resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.fileName ?? "Pasted resume"} · {r.createdAt.slice(0, 10)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Company" hint={linkedJd ? "Leave empty to use the JD's company." : undefined}>
          <Input value={form.company} onChange={(e) => set("company", e.target.value)} required={!linkedJd} />
        </Field>
        <Field label="Role title" hint={linkedJd ? "Leave empty to use the JD's title." : undefined}>
          <Input value={form.roleTitle} onChange={(e) => set("roleTitle", e.target.value)} required={!linkedJd} />
        </Field>
        <Field label="Source">
          <Select value={form.source} onChange={(e) => set("source", e.target.value)}>
            <option value="">Not set</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Role family" hint="Filled in automatically when left empty.">
          <Input value={form.roleFamily} onChange={(e) => set("roleFamily", e.target.value)} placeholder="e.g. data" />
        </Field>
        <Field label="Seniority">
          <Input value={form.seniority} onChange={(e) => set("seniority", e.target.value)} placeholder="e.g. Senior" />
        </Field>
        <Field label="Industry">
          <Input value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. Fintech" />
        </Field>
        <Field label="Company size">
          <Select value={form.companySize} onChange={(e) => set("companySize", e.target.value)}>
            <option value="">Not set</option>
            <option value="startup">Startup</option>
            <option value="mid">Mid-size</option>
            <option value="enterprise">Enterprise</option>
          </Select>
        </Field>
        <Field label="Location">
          <Input value={form.location} onChange={(e) => set("location", e.target.value)} />
        </Field>
        <Field label={application ? "Date applied" : "Date"}>
          <Input type="date" value={form.appliedAt} onChange={(e) => set("appliedAt", e.target.value)} required />
        </Field>
        <Field label="Follow up on">
          <Input type="date" value={form.followUpAt} onChange={(e) => set("followUpAt", e.target.value)} />
        </Field>
        {!application && (
          <Field label="Stage">
            <Select value={form.status} onChange={(e) => set("status", e.target.value as FormState["status"])}>
              <option value="applied">Applied</option>
              <option value="saved">Saved (not applied yet)</option>
            </Select>
          </Field>
        )}
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={form.tailored} onChange={(e) => set("tailored", e.target.checked)} />
          Resume tailored for this role
        </label>
      </div>
      <Field label="Notes">
        <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : application ? "Save changes" : "Add application"}
        </Button>
      </div>
    </form>
  );
}
