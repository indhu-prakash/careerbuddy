import { runWeeklyReview } from "@/lib/progress/weekly";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Weekly cron (Vercel sends `Authorization: Bearer $CRON_SECRET`): mark missed tasks and
// evaluate replan triggers for every active plan.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await runWeeklyReview());
}
