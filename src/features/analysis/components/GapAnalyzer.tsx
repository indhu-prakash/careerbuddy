"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { GapMapView, type GapMapData } from "./GapMapView";
import { FileDrop } from "./FileDrop";

const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const MAX_JDS = 5;

const panel = "grid content-start gap-3";

const ERRORS: Record<string, string> = {
  unauthorized: "Your session expired. Sign in again.",
  files_too_large: "Files are too large. Keep the total under 4 MB.",
  unsupported_file_type: "Use PDF, DOCX or TXT files.",
  unreadable_file: "We couldn't read one of the files. Try another format or paste the text.",
  resume_text_too_short: "We couldn't read text from that resume (it may be a scanned image). Paste the text instead.",
  missing_resume: "Add your resume.",
  missing_jd: "Add at least one job description.",
  too_many_jds: "Use at most 5 job descriptions.",
  ai_daily_limit: "You've reached today's AI limit. Try again tomorrow.",
  ai_busy: "The AI service is busy right now. Try again in a minute.",
  analysis_failed: "The analysis failed. Try again in a minute.",
};

export function GapAnalyzer({
  savedResume,
  activeRoleTitle,
}: {
  savedResume: { fileName: string | null; createdAt: string } | null;
  activeRoleTitle: string | null;
}) {
  const [resumeMode, setResumeMode] = useState<"saved" | "file" | "paste">(savedResume ? "saved" : "file");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [targetRole, setTargetRole] = useState(activeRoleTitle ?? "");
  const [jdTexts, setJdTexts] = useState<string[]>([""]);
  const [jdFiles, setJdFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GapMapData | null>(null);

  const filledJds = jdTexts.filter((t) => t.trim()).length + jdFiles.length;
  const hasResume =
    resumeMode === "saved" || (resumeMode === "paste" ? resumeText.trim().length > 0 : resumeFile !== null);

  async function analyze() {
    const totalBytes = (resumeMode === "file" ? (resumeFile?.size ?? 0) : 0) + jdFiles.reduce((n, f) => n + f.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) return setError(ERRORS.files_too_large);
    if (filledJds > MAX_JDS) return setError(ERRORS.too_many_jds);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      if (resumeMode === "paste") form.append("resumeText", resumeText);
      if (resumeMode === "file" && resumeFile) form.append("resume", resumeFile);
      if (targetRole.trim()) form.append("targetRole", targetRole.trim());
      for (const t of jdTexts) if (t.trim()) form.append("jdText", t);
      for (const f of jdFiles) form.append("jdFile", f);

      const res = await fetch("/api/v1/analyze", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(ERRORS[body.error] ?? "The analysis failed. Try again.");
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Your resume</h2>
            <div className="flex gap-3 text-sm font-medium">
              {savedResume && resumeMode !== "saved" && (
                <button type="button" onClick={() => setResumeMode("saved")} className="text-primary hover:underline">
                  Use saved resume
                </button>
              )}
              {resumeMode !== "file" && (
                <button type="button" onClick={() => setResumeMode("file")} className="text-primary hover:underline">
                  Upload a file
                </button>
              )}
              {resumeMode !== "paste" && (
                <button type="button" onClick={() => setResumeMode("paste")} className="text-primary hover:underline">
                  Paste text
                </button>
              )}
            </div>
          </div>
          {resumeMode === "saved" && savedResume && (
            <p className="rounded-lg bg-muted px-3 py-3 text-sm">
              Using your saved resume{savedResume.fileName ? ` (${savedResume.fileName})` : ""} from{" "}
              {new Date(savedResume.createdAt).toLocaleDateString()}, with the skills you reviewed.{" "}
              <a href="/onboarding" className="font-medium text-primary hover:underline">
                Edit skills
              </a>
            </p>
          )}
          {resumeMode === "paste" && (
            <Textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              rows={14}
              placeholder="Paste your resume here."
              className="min-h-[14rem]"
            />
          )}
          {resumeMode === "file" && (
            <FileDrop
              label="Upload resume"
              hint="PDF, DOCX or TXT, up to 4 MB"
              files={resumeFile ? [resumeFile] : []}
              onFiles={(fs) => setResumeFile(fs[0] ?? null)}
              onRemove={() => setResumeFile(null)}
              tall
            />
          )}
          <Field label="Target role" hint="Matched to a role template; used to fill gaps when you have fewer than 3 JDs.">
            <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. AI Engineer" />
          </Field>
        </Card>

        <Card className={panel}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Job descriptions</h2>
            <span className="text-sm text-muted-foreground">
              {filledJds} / {MAX_JDS} · 3+ recommended
            </span>
          </div>
          {jdTexts.map((text, i) => (
            <div key={i} className="grid gap-1">
              <Textarea
                value={text}
                onChange={(e) => setJdTexts((prev) => prev.map((t, j) => (j === i ? e.target.value : t)))}
                rows={6}
                placeholder={`Paste job description ${i + 1} here.`}
              />
              {jdTexts.length > 1 && (
                <button
                  type="button"
                  onClick={() => setJdTexts((prev) => prev.filter((_, j) => j !== i))}
                  className="justify-self-end text-sm text-muted-foreground hover:text-danger"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {jdTexts.length + jdFiles.length < MAX_JDS && (
            <Button variant="ghost" size="sm" onClick={() => setJdTexts((prev) => [...prev, ""])}>
              + Add another job description
            </Button>
          )}
          <FileDrop
            label="…or upload JD files"
            hint="PDF, DOCX or TXT"
            files={jdFiles}
            multiple
            onFiles={(fs) => setJdFiles((prev) => [...prev, ...fs].slice(0, MAX_JDS))}
            onRemove={(i) => setJdFiles((prev) => prev.filter((_, j) => j !== i))}
          />
        </Card>
      </div>

      <div className="grid gap-2 sm:flex sm:items-center sm:gap-4">
        <Button size="lg" onClick={analyze} disabled={busy || !hasResume || filledJds === 0}>
          {busy ? "Analyzing… (up to a minute)" : "Analyze skill gap"}
        </Button>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>

      {result && <GapMapView data={result} />}
    </div>
  );
}
