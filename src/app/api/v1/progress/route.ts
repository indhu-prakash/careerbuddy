import { z } from "zod";
import { isUuid, parseBody, withUser } from "@/lib/api";
import { db } from "@/lib/db";
import { recordProgress } from "@/lib/progress/record";

// F6: log activity that isn't a task update — study hours, or a 1-5 self-rating of a
// skill (which feeds the skill-level rule as self-reported evidence).
const BodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("hours_logged"),
    hours: z.number().positive().max(24),
    skillId: z.string().refine(isUuid).optional(),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({
    kind: z.literal("skill_level_changed"),
    skillId: z.string().refine(isUuid),
    rating: z.number().int().min(1).max(5),
    note: z.string().trim().max(500).optional(),
  }),
]);

export const POST = withUser(async (user, request) => {
  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;
  const e = body.data;

  if (e.skillId && !(await db.skill.findUnique({ where: { id: e.skillId }, select: { id: true } }))) {
    return Response.json({ error: "unknown_skill" }, { status: 400 });
  }
  await recordProgress({
    userId: user.id,
    kind: e.kind,
    skillId: e.skillId ?? null,
    hours: e.kind === "hours_logged" ? e.hours : null,
    value: e.kind === "skill_level_changed" ? e.rating : null,
    note: e.note ?? null,
  });

  const level = e.skillId
    ? await db.userSkill.findUnique({
        where: { userId_skillId: { userId: user.id, skillId: e.skillId } },
        select: { level: true, evidenceType: true },
      })
    : null;
  return Response.json({ ok: true, skill: level }, { status: 201 });
});

// Recent activity, newest first.
export const GET = withUser(async (user) => {
  const events = await db.progressEvent.findMany({
    where: { userId: user.id },
    orderBy: { occurredAt: "desc" },
    take: 50,
    select: {
      id: true,
      kind: true,
      hours: true,
      value: true,
      note: true,
      occurredAt: true,
      skill: { select: { name: true } },
      task: { select: { title: true } },
    },
  });
  return Response.json({ events });
});
