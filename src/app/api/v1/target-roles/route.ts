import { z } from "zod";
import { parseBody, withUser } from "@/lib/api";
import { db } from "@/lib/db";
import { setTargetRole } from "@/lib/intake/target-role";

// F1: the user's target roles (active first) and setting the active one.
export const GET = withUser(async (user) => {
  const roles = await db.targetRole.findMany({
    where: { userId: user.id },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      seniority: true,
      industry: true,
      location: true,
      salaryExpectation: true,
      hoursPerWeek: true,
      horizonWeeks: true,
      isActive: true,
      roleTrack: { select: { slug: true, title: true, family: true } },
    },
  });
  return Response.json({ targetRoles: roles });
});

const optionalText = z.string().trim().max(120).nullable().optional();

const BodySchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    seniority: optionalText,
    industry: optionalText,
    location: optionalText,
    salaryExpectation: optionalText,
    hoursPerWeek: z.number().int().min(1).max(80).nullable().optional(),
    horizonWeeks: z.union([z.literal(4), z.literal(8), z.literal(12), z.literal(16)]).nullable().optional(),
    roleTrackSlug: z.string().trim().max(80).nullable().optional(),
  })
  .strict();

export const POST = withUser(async (user, request) => {
  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;
  return Response.json({ targetRole: await setTargetRole(user.id, body.data) });
});
