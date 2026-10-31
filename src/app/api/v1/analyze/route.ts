import { aiErrorResponse, withUser } from "@/lib/api";
import { docKind, extractText } from "@/lib/analysis/extract-text";
import { MissingResumeError, runGapAnalysis } from "@/lib/analysis/run";

// Extraction calls on free models can take a while.
export const maxDuration = 300;

// Under Vercel's 4.5 MB request body limit.
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const MAX_JDS = 5;
const MAX_CHARS = 30_000;
const MIN_RESUME_CHARS = 200;

// Skill-gap analysis. Body: multipart/form-data with
//   resume (file: pdf/docx/txt) or resumeText — optional once a resume was saved in onboarding,
//   jdText (one or more) and/or jdFile (one or more), at least one JD in total,
//   targetRole (optional; defaults to the active target role, then the first JD's title).
// Responds with the saved analysis (same shape as GET /api/v1/analyses/:id).
export const POST = withUser(async (user, request) => {
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "invalid_body" }, { status: 400 });

  const files = [...form.getAll("resume"), ...form.getAll("jdFile")].filter(
    (v): v is File => v instanceof File && v.size > 0,
  );
  if (files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) {
    return Response.json({ error: "files_too_large", maxBytes: MAX_TOTAL_BYTES }, { status: 413 });
  }

  let resume: { text: string; file: { name: string; mimeType: string; bytes: Uint8Array } | null } | null = null;
  let jds: { text: string; source: "pasted" | "file" }[];
  try {
    const resumeFile = form.get("resume");
    if (resumeFile instanceof File && resumeFile.size > 0) {
      const kind = docKind(resumeFile.name, resumeFile.type);
      if (!kind) throw new UnsupportedFileError(resumeFile.name);
      const bytes = new Uint8Array(await resumeFile.arrayBuffer());
      resume = { text: await extractText(bytes, kind), file: { name: resumeFile.name, mimeType: resumeFile.type, bytes } };
    } else {
      const text = String(form.get("resumeText") ?? "").trim();
      if (text) resume = { text, file: null };
    }

    const jdTexts = form.getAll("jdText").map((v) => ({ text: String(v).trim(), source: "pasted" as const }));
    const jdFiles = await Promise.all(
      form.getAll("jdFile").map(async (v) => ({ text: await fileText(v), source: "file" as const })),
    );
    jds = [...jdTexts, ...jdFiles].filter((jd) => jd.text);
  } catch (error) {
    if (error instanceof UnsupportedFileError) {
      return Response.json({ error: "unsupported_file_type", file: error.fileName }, { status: 415 });
    }
    console.error("[analyze] parse", error);
    return Response.json({ error: "unreadable_file" }, { status: 422 });
  }

  // Scanned (image-only) PDFs extract to almost nothing; ask for text instead of guessing.
  if (resume && resume.text.length < MIN_RESUME_CHARS) {
    return Response.json({ error: "resume_text_too_short" }, { status: 422 });
  }
  if (jds.length === 0) return Response.json({ error: "missing_jd" }, { status: 400 });
  if (jds.length > MAX_JDS) return Response.json({ error: "too_many_jds", max: MAX_JDS }, { status: 400 });

  try {
    const analysis = await runGapAnalysis({
      userId: user.id,
      resume: resume ? { ...resume, text: resume.text.slice(0, MAX_CHARS) } : null,
      jds: jds.map((jd) => ({ ...jd, text: jd.text.slice(0, MAX_CHARS) })),
      targetRoleTitle: String(form.get("targetRole") ?? "").trim().slice(0, 200) || null,
    });
    return Response.json(analysis);
  } catch (error) {
    if (error instanceof MissingResumeError) {
      return Response.json({ error: "missing_resume" }, { status: 400 });
    }
    const ai = aiErrorResponse(error);
    if (ai) return ai;
    console.error("[analyze]", error);
    return Response.json({ error: "analysis_failed" }, { status: 502 });
  }
});

class UnsupportedFileError extends Error {
  constructor(readonly fileName: string) {
    super(`Unsupported file: ${fileName}`);
  }
}

async function fileText(value: FormDataEntryValue): Promise<string> {
  if (!(value instanceof File) || value.size === 0) return "";
  const kind = docKind(value.name, value.type);
  if (!kind) throw new UnsupportedFileError(value.name);
  return extractText(new Uint8Array(await value.arrayBuffer()), kind);
}
