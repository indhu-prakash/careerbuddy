import { z } from "zod";
import { isUuid, notFound, parseBody, withUser } from "@/lib/api";
import { TaskUpdateError, updateTask } from "@/lib/plan/tasks";

const BodySchema = z
  .object({
    status: z.enum(["todo", "doing", "done", "skipped", "missed"]).optional(),
    hoursSpent: z.number().min(0).max(200).optional(),
    score: z.number().min(0).max(1).nullable().optional(), // assessments only, 0..1
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "Nothing to update" });

// Tick off a task, log hours or record an assessment score; writes progress events.
export const PATCH = withUser<{ params: Promise<{ id: string }> }>(async (user, request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;
  try {
    const task = await updateTask(user.id, id, body.data);
    return task ? Response.json(task) : notFound();
  } catch (error) {
    if (error instanceof TaskUpdateError) return Response.json({ error: error.code }, { status: 400 });
    throw error;
  }
});
