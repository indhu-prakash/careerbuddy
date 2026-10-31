import { aiErrorResponse, withUser } from "@/lib/api";
import { docKind, extractText } from "@/lib/analysis/extract-text";
import { getPrimaryResume, ingestResume } from "@/lib/intake/resume";
import { listInventory } from "@/lib/intake/skills";

export const maxDuration = 300;

const MAX_BYTES = 4 * 1024 * 1024; // under Vercel's 4.5 MB request body limit
const MAX_CHARS = 30_000;
const MIN_CHARS = 200;

// F1. multipart/form-data: resume (pdf/docx/txt file) or resumeText.
// Parses once (same text is never sent to the model again), stores PDF/DOCX in the
// private bucket, and returns the profile plus the draft skills inventory.
export const POST = withUser(async (user, request) => {
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "invalid_body" }, { status: 400 });

  let text = String(form.get("resumeText") ?? "").trim();
  let file: { name: string; mimeType: string; bytes: Uint8Array } | null = null;
  const upload = form.get("resume");
  if (upload instanceof File && upload.size > 0) {
    if (upload.size > MAX_BYTES) return Response.json({ error: "file_too_large", maxBytes: MAX_BYTES }, { status: 413 });
    const kind = docKind(upload.name, upload.type);
    if (!kind) return Response.json({ error: "unsupported_file_type" }, { status: 415 });
    const bytes = new Uint8Array(await upload.arrayBuffer());
    try {
      text = await extractText(bytes, kind);
    } catch (error) {
      console.error("[resumes] parse", error);
      return Response.json({ error: "unreadable_file" }, { status: 422 });
    }
    file = { name: upload.name, mimeType: upload.type, bytes };
  }

  if (!text) return Response.json({ error: "missing_resume" }, { status: 400 });
  // Scanned (image-only) PDFs extract to almost nothing; ask for pasted text instead.
  if (text.length < MIN_CHARS) return Response.json({ error: "resume_text_too_short" }, { status: 422 });

  try {
    const result = await ingestResume({ userId: user.id, text: text.slice(0, MAX_CHARS), file });
    return Response.json({ ...result, skills: await listInventory(user.id) });
  } catch (error) {
    const ai = aiErrorResponse(error);
    if (ai) return ai;
    console.error("[resumes]", error);
    return Response.json({ error: "extraction_failed" }, { status: 502 });
  }
});

// The primary resume's parsed profile (no raw text).
export const GET = withUser(async (user) => {
  const resume = await getPrimaryResume(user.id);
  if (!resume) return Response.json({ resume: null });
  return Response.json({
    resume: { id: resume.id, fileName: resume.fileName, createdAt: resume.createdAt, parsed: resume.parsed, stored: !!resume.storagePath },
  });
});
