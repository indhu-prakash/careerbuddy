import { parseBody, withUser } from "@/lib/api";
import { CreateApplicationSchema, ListQuerySchema } from "@/lib/applications/schemas";
import { ApplicationInputError, createApplication, listApplications } from "@/lib/applications/service";

// The signed-in user's applications, newest first. Optional ?status= filter.
export const GET = withUser(async (user, request) => {
  const query = ListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return Response.json({ error: "invalid_query", issues: query.error.issues }, { status: 400 });
  return Response.json({ applications: await listApplications(user.id, query.data.status) });
});

// Log an application. Match score and role family are filled from the linked JD.
export const POST = withUser(async (user, request) => {
  const body = await parseBody(request, CreateApplicationSchema);
  if ("response" in body) return body.response;
  try {
    const application = await createApplication(user.id, body.data);
    return Response.json({ application }, { status: 201 });
  } catch (error) {
    if (error instanceof ApplicationInputError) return Response.json({ error: error.code }, { status: 400 });
    throw error;
  }
});
