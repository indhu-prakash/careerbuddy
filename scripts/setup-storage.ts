// One-time (idempotent) Supabase Storage setup: creates the private resumes bucket.
// Run with: npm run supabase:setup
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "resumes";
const options = {
  public: false,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env first.");
  }
  const storage = createClient(url, secretKey, { auth: { persistSession: false } }).storage;

  const { data: existing } = await storage.getBucket(BUCKET);
  const { error } = existing
    ? await storage.updateBucket(BUCKET, options)
    : await storage.createBucket(BUCKET, options);
  if (error) throw error;
  console.log(`Bucket "${BUCKET}" ${existing ? "updated" : "created"} (private, 5 MB, PDF/DOCX).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
