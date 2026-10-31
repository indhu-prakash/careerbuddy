import { aiErrorResponse, withUser } from "@/lib/api";
import { getApplicationInsights } from "@/lib/applications/insights";

export const maxDuration = 120;

// Segment response rates; ?advice=1 also asks the LLM to phrase 2-3 suggestions from them.
export const GET = withUser(async (user, request) => {
  const advice = new URL(request.url).searchParams.get("advice") === "1";
  try {
    return Response.json(await getApplicationInsights(user.id, { advice }));
  } catch (error) {
    const aiResponse = aiErrorResponse(error);
    if (aiResponse) return aiResponse;
    console.error("[applications] insights advice failed", error);
    return Response.json({ error: "advice_failed" }, { status: 502 });
  }
});
