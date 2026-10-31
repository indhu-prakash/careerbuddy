import { isUuid, notFound, withUser } from "@/lib/api";
import { replanErrorResponse } from "@/lib/progress/http";
import { acceptReplan } from "@/lib/progress/replan";

// F6: activate a proposed plan revision; the previous version is superseded.
export const POST = withUser<{ params: Promise<{ id: string }> }>(async (user, _request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  try {
    return Response.json(await acceptReplan(user.id, id));
  } catch (error) {
    return replanErrorResponse(error, "replan-accept");
  }
});
