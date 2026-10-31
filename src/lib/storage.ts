import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Private bucket; created by `npm run supabase:setup`. Objects are only reachable
// through short-lived signed URLs issued here after an ownership check.
export const RESUME_BUCKET = "resumes";
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
export const RESUME_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const DOWNLOAD_URL_TTL_SECONDS = 60;

/** Object key for a resume. The first path segment is always the owner's id. */
export function resumeObjectPath(userId: string, resumeId: string, mimeType: string): string {
  const ext = mimeType === "application/pdf" ? "pdf" : "docx";
  return `${userId}/${resumeId}/resume.${ext}`;
}

/**
 * Signed URL the browser uploads to directly, which keeps file bytes out of the
 * Vercel function (4.5 MB request body limit).
 */
export async function createResumeUploadUrl(userId: string, resumeId: string, mimeType: string) {
  const path = resumeObjectPath(userId, resumeId, mimeType);
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(RESUME_BUCKET)
    .createSignedUploadUrl(path);
  if (error) throw error;
  return { path, signedUrl: data.signedUrl, token: data.token };
}

/** Short-lived download URL. Refuses paths outside the caller's own folder. */
export async function createResumeDownloadUrl(userId: string, path: string): Promise<string> {
  assertOwnedPath(userId, path);
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(RESUME_BUCKET)
    .createSignedUrl(path, DOWNLOAD_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

/** Read an uploaded resume for parsing. */
export async function downloadResume(userId: string, path: string): Promise<Blob> {
  assertOwnedPath(userId, path);
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(RESUME_BUCKET)
    .download(path);
  if (error) throw error;
  return data;
}

/** Delete every stored file for a user (account deletion). */
export async function deleteUserFiles(userId: string): Promise<void> {
  const storage = createSupabaseAdminClient().storage.from(RESUME_BUCKET);
  const { data: folders, error } = await storage.list(userId, { limit: 1000 });
  if (error) throw error;
  const paths: string[] = [];
  for (const folder of folders) {
    const { data: files, error: listError } = await storage.list(`${userId}/${folder.name}`);
    if (listError) throw listError;
    for (const file of files) paths.push(`${userId}/${folder.name}/${file.name}`);
  }
  if (paths.length > 0) {
    const { error: removeError } = await storage.remove(paths);
    if (removeError) throw removeError;
  }
}

function assertOwnedPath(userId: string, path: string) {
  if (!path.startsWith(`${userId}/`) || path.includes("..")) {
    throw new Error("Storage path does not belong to this user");
  }
}
