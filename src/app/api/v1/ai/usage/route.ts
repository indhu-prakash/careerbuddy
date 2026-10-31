import { requireUser, UnauthorizedError } from "@/lib/auth";
import { getAiUsageToday } from "@/lib/ai/service";

// Today's AI requests for the signed-in user against their daily limit (UTC day).
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }
  return Response.json(await getAiUsageToday(user.id));
}
