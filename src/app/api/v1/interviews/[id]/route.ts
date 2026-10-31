import { isUuid, notFound, withUser } from "@/lib/api";
import { getSessionView } from "@/lib/interview/sessions";

type Ctx = { params: Promise<{ id: string }> };

// One session with its questions, rubrics, answers, evaluations and summary.
export const GET = withUser<Ctx>(async (user, _request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const session = await getSessionView(user.id, id);
  return session ? Response.json(session) : notFound();
});
