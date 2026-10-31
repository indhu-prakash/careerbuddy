import { isUuid, notFound, withUser } from "@/lib/api";
import { replanErrorResponse } from "@/lib/progress/http";
import { proposeReplan } from "@/lib/progress/replan";

// Week text for the revised plan comes from one AI call (template text if unavailable).
export const maxDuration = 300;

// F6: propose a revised version of the active plan (saved as a draft with a diff).
export const POST = withUser<{ params: Promise<{ id: string }> }>(async (user, _request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  try {
    return Response.json(await proposeReplan(user.id, id), { status: 201 });
  } catch (error) {
    return replanErrorResponse(error, "replan");
  }
});
