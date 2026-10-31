import { z } from "zod";
import { aiErrorResponse, parseBody, withUser } from "@/lib/api";
import { QUESTION_TYPES } from "@/lib/ai/prompts/interview-scoring";
import { evaluateAnswer } from "@/lib/interview/evaluate";

export const maxDuration = 300;

const BodySchema = z.object({
  question: z.string().trim().min(5).max(2000),
  type: z.enum(QUESTION_TYPES),
  answer: z.string().trim().min(1).max(10000),
  targetRole: z.string().trim().max(200).optional(),
});

// Score a practice answer against the default rubric for its question type.
// Stateless: saved sessions go through /api/v1/interviews instead.
export const POST = withUser(async (user, request) => {
  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;
  try {
    return Response.json(
      await evaluateAnswer({ ...body.data, targetRole: body.data.targetRole || undefined, userId: user.id }),
    );
  } catch (error) {
    const ai = aiErrorResponse(error);
    if (ai) return ai;
    console.error("[interview]", error);
    return Response.json({ error: "scoring_failed" }, { status: 502 });
  }
});
