import { z } from "zod";
import { isUuid, notFound, parseBody, withUser } from "@/lib/api";
import { updateProject } from "@/lib/projects/service";

const BodySchema = z
  .object({
    status: z.enum(["suggested", "in_progress", "done", "dropped"]).optional(),
    repoUrl: z
      .url({ protocol: /^https?$/ })
      .max(500)
      .nullable()
      .optional(),
  })
  .refine((b) => b.status !== undefined || b.repoUrl !== undefined, { message: "Nothing to update" });

// Track a project: status (suggested -> in_progress -> done / dropped) and repo URL.
export const PATCH = withUser<{ params: Promise<{ id: string }> }>(async (user, request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;
  const project = await updateProject(user.id, id, body.data);
  return project ? Response.json(project) : notFound();
});
