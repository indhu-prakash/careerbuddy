import { z } from "zod";
import { parseBody, withUser } from "@/lib/api";
import { db } from "@/lib/db";
import { deleteUserFiles } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const profileSelect = {
  id: true,
  email: true,
  name: true,
  currentRole: true,
  yearsExperience: true,
  location: true,
  industry: true,
  salaryExpectation: true,
  careerGoal: true,
  hoursPerWeek: true,
  targetDate: true,
  onboardedAt: true,
} as const;

// The signed-in user's profile.
export const GET = withUser(async (user) =>
  Response.json(await db.user.findUniqueOrThrow({ where: { id: user.id }, select: profileSelect })),
);

const text = z.string().trim().max(200).nullable().optional();

const PatchSchema = z
  .object({
    name: text,
    currentRole: text,
    yearsExperience: z.number().min(0).max(60).nullable().optional(),
    location: text,
    industry: text,
    salaryExpectation: text,
    careerGoal: z.string().trim().max(1000).nullable().optional(),
    hoursPerWeek: z.number().int().min(1).max(80).optional(),
    targetDate: z.iso.date().nullable().optional(), // YYYY-MM-DD
    onboarded: z.literal(true).optional(), // marks onboarding complete
  })
  .strict();

// F1 onboarding fields (hours per week and timeline feed the learning plan).
export const PATCH = withUser(async (user, request) => {
  const body = await parseBody(request, PatchSchema);
  if ("response" in body) return body.response;
  const { onboarded, targetDate, ...fields } = body.data;
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      ...fields,
      ...(targetDate !== undefined ? { targetDate: targetDate ? new Date(targetDate) : null } : {}),
      ...(onboarded ? { onboardedAt: new Date() } : {}),
    },
    select: profileSelect,
  });
  return Response.json(updated);
});

// Delete my data: stored files, then the auth user. All app rows cascade from the
// users row, which itself cascades from auth.users on Supabase.
export const DELETE = withUser(async (user) => {
  try {
    await deleteUserFiles(user.id);
  } catch (error) {
    console.error("[me] deleting files", error);
    return Response.json({ error: "delete_failed" }, { status: 502 });
  }
  await db.user.delete({ where: { id: user.id } });
  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(user.id);
  if (error) console.error("[me] deleting auth user", error);
  return new Response(null, { status: 204 });
});
