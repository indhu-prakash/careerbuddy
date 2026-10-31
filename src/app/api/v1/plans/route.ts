import { z } from "zod";
import { aiErrorResponse, parseBody, withUser } from "@/lib/api";
import { createPlan, listPlans, PlanInputError } from "@/lib/plan/service";

// One AI call writes the week text; free models can take up to a minute.
export const maxDuration = 300;

const BodySchema = z.object({
  gapAnalysisId: z.uuid().optional(),
  weeks: z.number().int().min(1).max(26).optional(),
  hoursPerWeek: z.number().int().min(1).max(60).optional(),
});

// The user's plans (all versions), newest first.
export const GET = withUser(async (user) => Response.json({ plans: await listPlans(user.id) }));

// Schedule and save a new active plan from a gap analysis (default: the latest one).
export const POST = withUser(async (user, request) => {
  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;
  try {
    const plan = await createPlan(user.id, body.data);
    if (!plan) return Response.json({ error: "no_analysis" }, { status: 404 });
    return Response.json(plan, { status: 201 });
  } catch (error) {
    if (error instanceof PlanInputError) return Response.json({ error: error.code }, { status: 422 });
    const ai = aiErrorResponse(error);
    if (ai) return ai;
    console.error("[plans]", error);
    return Response.json({ error: "plan_failed" }, { status: 500 });
  }
});
