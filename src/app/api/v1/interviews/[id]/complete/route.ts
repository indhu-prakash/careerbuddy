import { isUuid, notFound, withUser } from "@/lib/api";
import { interviewErrorResponse } from "@/lib/interview/http";
import { completeSession, getSessionView } from "@/lib/interview/sessions";

// The summary is one call to a free model (~30-60 s).
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

// Close the session and build its report (scores in code, narrative from one LLM call).
export const POST = withUser<Ctx>(async (user, _request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  try {
    await completeSession(user.id, id);
    return Response.json(await getSessionView(user.id, id));
  } catch (error) {
    return interviewErrorResponse(error, "summary_failed");
  }
});
