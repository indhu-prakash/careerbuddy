import { z } from "zod";
import { isUuid, notFound, parseBody, withUser } from "@/lib/api";
import { interviewErrorResponse } from "@/lib/interview/http";
import { getSessionView, submitAnswer } from "@/lib/interview/sessions";

// Scoring is one call to a free model (~30-60 s).
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

const BodySchema = z.object({
  questionId: z.string().refine(isUuid, "invalid id"),
  answer: z.string().trim().min(1).max(10000),
});

// Score one answer, save it, maybe add a follow-up; returns the evaluation and the next question.
export const POST = withUser<Ctx>(async (user, request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;
  try {
    const { evaluation, followedUp } = await submitAnswer(user.id, id, body.data.questionId, body.data.answer);
    const session = (await getSessionView(user.id, id))!;
    const nextQuestion = session.questions.find((q) => q.id === session.nextQuestionId) ?? null;
    return Response.json({ evaluation, followedUp, nextQuestion, session });
  } catch (error) {
    return interviewErrorResponse(error, "scoring_failed");
  }
});
