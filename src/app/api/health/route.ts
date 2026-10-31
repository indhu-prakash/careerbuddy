import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = {
    supabaseUrlSet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabasePublishableKeySet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    supabaseSecretKeySet: Boolean(process.env.SUPABASE_SECRET_KEY),
    openrouterKeySet: Boolean(process.env.OPENROUTER_API_KEY),
  };
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: "connected", ...config });
  } catch {
    return Response.json({ ok: false, db: "unreachable", ...config }, { status: 503 });
  }
}
