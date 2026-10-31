import { isUuid, notFound, withUser } from "@/lib/api";
import { replanErrorResponse } from "@/lib/progress/http";
import { discardReplan } from "@/lib/progress/replan";

// F6: reject a proposed plan revision and keep the current plan.
export const POST = withUser<{ params: Promise<{ id: string }> }>(async (user, _request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  try {
    await discardReplan(user.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    return replanErrorResponse(error, "replan-discard");
  }
});
