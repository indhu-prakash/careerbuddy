import { ghostStaleApplications } from "@/lib/applications/ghost";

export const dynamic = "force-dynamic";

// Daily cron (Vercel sends `Authorization: Bearer $CRON_SECRET`): auto-ghost stale applications.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await ghostStaleApplications());
}
