import { z } from "zod";
import { aiErrorResponse, parseBody, withUser } from "@/lib/api";
import { ProjectInputError, suggestProjects } from "@/lib/projects/service";

// One AI call proposes the candidates; free models can take up to a minute.
export const maxDuration = 300;

const BodySchema = z.object({
  gapAnalysisId: z.uuid().optional(),
  planId: z.uuid().optional(),
});

// Suggest 2-4 projects covering the biggest gaps and fit their milestones into the plan.
export const POST = withUser(async (user, request) => {
  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;
  try {
    const result = await suggestProjects(user.id, body.data);
    if (!result) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectInputError) return Response.json({ error: error.code }, { status: 422 });
    const ai = aiErrorResponse(error);
    if (ai) return ai;
    console.error("[projects]", error);
    return Response.json({ error: "suggest_failed" }, { status: 502 });
  }
});
