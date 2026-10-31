import { isUuid, notFound, parseBody, withUser } from "@/lib/api";
import { CreateEventSchema } from "@/lib/applications/schemas";
import { addEvent } from "@/lib/applications/service";

type Ctx = { params: Promise<{ id: string }> };

// Move an application to a stage (or add a note at its current stage).
export const POST = withUser<Ctx>(async (user, request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const body = await parseBody(request, CreateEventSchema);
  if ("response" in body) return body.response;
  const result = await addEvent(user.id, id, body.data);
  return result ? Response.json(result, { status: 201 }) : notFound();
});
