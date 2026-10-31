import { isUuid, notFound, parseBody, withUser } from "@/lib/api";
import { UpdateApplicationSchema } from "@/lib/applications/schemas";
import {
  ApplicationInputError,
  deleteApplication,
  getApplication,
  updateApplication,
} from "@/lib/applications/service";

type Ctx = { params: Promise<{ id: string }> };

// One application with its full event history. Other users' applications are 404.
export const GET = withUser<Ctx>(async (user, _request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const application = await getApplication(user.id, id);
  return application ? Response.json({ application }) : notFound();
});

// Edit details. Status changes go through POST /events so they're recorded.
export const PATCH = withUser<Ctx>(async (user, request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const body = await parseBody(request, UpdateApplicationSchema);
  if ("response" in body) return body.response;
  try {
    const application = await updateApplication(user.id, id, body.data);
    return application ? Response.json({ application }) : notFound();
  } catch (error) {
    if (error instanceof ApplicationInputError) return Response.json({ error: error.code }, { status: 400 });
    throw error;
  }
});

export const DELETE = withUser<Ctx>(async (user, _request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  return (await deleteApplication(user.id, id)) ? new Response(null, { status: 204 }) : notFound();
});
