import { z } from "zod";
import { isUuid, parseBody, withUser } from "@/lib/api";
import { interviewErrorResponse } from "@/lib/interview/http";
import { DEFAULT_QUESTIONS, INTERVIEW_KINDS, MAX_QUESTIONS, MIN_QUESTIONS } from "@/lib/interview/plan";
import { createSession, getSessionView, listSessions } from "@/lib/interview/sessions";

// Question generation is one call to a free model (~30-60 s).
export const maxDuration = 300;

const BodySchema = z.object({
  targetRoleId: z.string().refine(isUuid, "invalid id").optional(),
  targetRoleTitle: z.string().trim().min(2).max(200).optional(),
  kind: z.enum(INTERVIEW_KINDS).default("mixed"),
  count: z.number().int().min(MIN_QUESTIONS).max(MAX_QUESTIONS).default(DEFAULT_QUESTIONS),
});

// Interview history, newest first.
export const GET = withUser(async (user) => Response.json({ sessions: await listSessions(user.id) }));

// Start a session: generate role- and gap-targeted questions and save them.
export const POST = withUser(async (user, request) => {
  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;
  try {
    const { id } = await createSession(user.id, body.data);
    return Response.json(await getSessionView(user.id, id), { status: 201 });
  } catch (error) {
    return interviewErrorResponse(error, "generation_failed");
  }
});
