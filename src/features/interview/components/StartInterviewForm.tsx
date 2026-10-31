"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { DEFAULT_QUESTIONS, INTERVIEW_KINDS, MAX_QUESTIONS, MIN_QUESTIONS } from "@/lib/interview/plan";
import { apiError, KIND_LABELS } from "../types";

const OTHER = "other";

/** Pick a target role, interview kind and length; generates the questions and opens the session. */
export function StartInterviewForm({
  roles,
  defaultRoleId,
}: {
  roles: { id: string; title: string; hasAnalysis: boolean }[];
  defaultRoleId: string | null;
}) {
  const router = useRouter();
  const [roleId, setRoleId] = useState(defaultRoleId ?? roles[0]?.id ?? OTHER);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<(typeof INTERVIEW_KINDS)[number]>("mixed");
  const [count, setCount] = useState(DEFAULT_QUESTIONS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = roles.find((r) => r.id === roleId);
  const ready = roleId !== OTHER || title.trim().length >= 2;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          roleId === OTHER ? { targetRoleTitle: title.trim(), kind, count } : { targetRoleId: roleId, kind, count },
        ),
      });
      if (!res.ok) throw new Error(await apiError(res, "Couldn't generate questions. Try again."));
      const session = await res.json();
      router.push(`/interview/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <Card className="grid gap-5">
      {/* Row 1: which role (and its title when it's not a saved one). The hint sits under
          the whole row so both controls stay on one line. */}
      <div className="grid gap-2">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Target role">
            <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
              <option value={OTHER}>Another role…</option>
            </Select>
          </Field>
          {roleId === OTHER ? (
            <Field label="Role title">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Data Engineer"
                maxLength={200}
              />
            </Field>
          ) : (
            <div className="hidden sm:block" aria-hidden />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {roleId === OTHER
            ? "Questions will be general for this role. Run a gap analysis to target your gaps."
            : role?.hasAnalysis
              ? "Questions target the biggest gaps from your latest analysis."
              : "No gap analysis for this role yet, so questions will be general."}
        </p>
      </div>
      {/* Row 2: interview type and length, always side by side. */}
      <div className="grid gap-2">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Interview type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              {INTERVIEW_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Questions">
            <Select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {Array.from({ length: MAX_QUESTIONS - MIN_QUESTIONS + 1 }, (_, i) => MIN_QUESTIONS + i).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">Weak answers may add up to 2 follow-up questions.</p>
      </div>
      <Button onClick={start} disabled={busy || !ready} className="sm:justify-self-start">
        {busy ? "Generating questions… (up to a minute)" : "Start interview"}
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
    </Card>
  );
}
