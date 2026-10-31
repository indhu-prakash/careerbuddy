"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { APPLICATION_STATUSES, SOURCE_LABELS, type AppStatus } from "@/lib/scoring/applications";
import { apiRequest, formatDate, pct, STATUS_LABELS, STATUS_TONES } from "../labels";
import type { ApplicationDetail, ApplicationRow, LinkOptions } from "../types";
import { ApplicationForm } from "./ApplicationForm";

const today = () => new Date().toISOString().slice(0, 10);

/** One application: details, stage history, and the "move to stage" form. */
export function ApplicationDetailPanel({
  id,
  options,
  onChanged,
  onDeleted,
  onClose,
}: {
  id: string;
  options: LinkOptions;
  onChanged: (app: ApplicationRow) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<AppStatus>("screening");
  const [occurredAt, setOccurredAt] = useState(today);
  const [rejectionReason, setRejectionReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setEditing(false);
    apiRequest<{ application: ApplicationDetail }>(`/api/v1/applications/${id}`)
      .then(({ application }) => {
        if (cancelled) return;
        setDetail(application);
        setStage(nextStage(application.status));
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function addEvent(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { event, application } = await apiRequest<{
        event: ApplicationDetail["events"][number];
        application: ApplicationRow;
      }>(`/api/v1/applications/${id}/events`, {
        method: "POST",
        body: JSON.stringify({
          stage,
          occurredAt: new Date(`${occurredAt}T12:00:00`).toISOString(),
          rejectionReason: stage === "rejected" ? rejectionReason || null : null,
          feedback: feedback || null,
          notes: notes || null,
        }),
      });
      setDetail((d) => (d ? { ...d, ...application, events: [...d.events, event] } : d));
      setRejectionReason("");
      setFeedback("");
      setNotes("");
      setStage(nextStage(application.status));
      onChanged(application);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this application and its history?")) return;
    setBusy(true);
    try {
      await apiRequest(`/api/v1/applications/${id}`, { method: "DELETE" });
      onDeleted(id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!detail) {
    return (
      <Card>
        {error ? <Alert tone="danger">{error}</Alert> : <p className="text-sm text-muted-foreground">Loading…</p>}
      </Card>
    );
  }

  if (editing) {
    return (
      <Card>
        <h2 className="mb-4 font-display text-lg font-semibold">Edit application</h2>
        <ApplicationForm
          application={detail}
          options={options}
          onCancel={() => setEditing(false)}
          onSaved={(app) => {
            setDetail((d) => (d ? { ...d, ...app } : d));
            setEditing(false);
            onChanged(app);
          }}
        />
      </Card>
    );
  }

  const facts: [string, string][] = [
    ["Source", detail.source ? SOURCE_LABELS[detail.source] : "–"],
    ["Match score", pct(detail.matchScore)],
    ["Role family", detail.roleFamily ?? "–"],
    ["Seniority", detail.seniority ?? "–"],
    ["Industry", detail.industry ?? "–"],
    ["Applied", formatDate(detail.appliedAt)],
    ["First response", formatDate(detail.respondedAt)],
    ["Follow up", formatDate(detail.followUpAt)],
  ];

  return (
    <Card className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{detail.roleTitle}</h2>
          <p className="text-muted-foreground">
            {detail.company}
            {detail.location ? ` · ${detail.location}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONES[detail.status]}>{STATUS_LABELS[detail.status]}</Badge>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {detail.jobDescription && (
        <p className="text-sm text-muted-foreground">
          Linked JD: {[detail.jobDescription.title, detail.jobDescription.company].filter(Boolean).join(" · ")}
        </p>
      )}
      {detail.notes && <p className="text-sm whitespace-pre-wrap">{detail.notes}</p>}

      <section>
        <h3 className="mb-2 text-sm font-semibold">History</h3>
        <ol className="grid gap-2 border-l border-border pl-4">
          {detail.events.map((ev) => (
            <li key={ev.id} className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONES[ev.stage]}>{STATUS_LABELS[ev.stage]}</Badge>
                <span className="text-muted-foreground">{formatDate(ev.occurredAt)}</span>
              </div>
              {ev.rejectionReason && <p className="mt-1">Reason: {ev.rejectionReason}</p>}
              {ev.feedback && <p className="mt-1">Feedback: {ev.feedback}</p>}
              {ev.notes && <p className="mt-1 text-muted-foreground">{ev.notes}</p>}
            </li>
          ))}
        </ol>
      </section>

      <form onSubmit={addEvent} className="grid gap-3 rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold">Update stage</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Stage">
            <Select value={stage} onChange={(e) => setStage(e.target.value as AppStatus)}>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                  {s === detail.status ? " (current, add a note)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} required />
          </Field>
          {stage === "rejected" && (
            <Field label="Rejection reason">
              <Input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
            </Field>
          )}
          <Field label="Feedback">
            <Input value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={busy}>
              Edit details
            </Button>
            <Button size="sm" variant="ghost" onClick={remove} disabled={busy}>
              Delete
            </Button>
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save stage"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// Sensible default for the next stage in the pipeline.
function nextStage(status: AppStatus): AppStatus {
  const next: Partial<Record<AppStatus, AppStatus>> = {
    saved: "applied",
    applied: "screening",
    screening: "interviewing",
    interviewing: "offer",
  };
  return next[status] ?? status;
}
