import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { matchRoleTrack } from "@/lib/skills/roles";

type Client = Prisma.TransactionClient | typeof db;

export type TargetRoleInput = {
  title: string;
  seniority?: string | null;
  industry?: string | null;
  location?: string | null;
  salaryExpectation?: string | null;
  hoursPerWeek?: number | null;
  horizonWeeks?: number | null; // 4 | 8 | 12 | 16
  roleTrackSlug?: string | null; // manual pick when the title doesn't match a template
};

/**
 * F1: set the user's active target role. The title is matched to one of the seeded role
 * templates unless the user picked one. Hours and horizon also update the user's
 * profile (hoursPerWeek, targetDate) because the plan reads them from there too.
 */
export async function setTargetRole(userId: string, input: TargetRoleInput) {
  const title = input.title.trim();
  const tracks = await db.roleTrack.findMany({ select: { id: true, slug: true, title: true, aliases: true } });
  const track = input.roleTrackSlug
    ? tracks.find((t) => t.slug === input.roleTrackSlug)
    : matchRoleTrack(title, tracks);

  const fields = {
    title,
    seniority: input.seniority ?? null,
    industry: input.industry ?? null,
    location: input.location ?? null,
    salaryExpectation: input.salaryExpectation ?? null,
    hoursPerWeek: input.hoursPerWeek ?? null,
    horizonWeeks: input.horizonWeeks ?? null,
    roleTrackId: track?.id ?? null,
    isActive: true,
  };

  return db.$transaction(async (tx) => {
    const existing = await tx.targetRole.findFirst({
      where: { userId, title: { equals: title, mode: "insensitive" } },
      select: { id: true },
    });
    const role = existing
      ? await tx.targetRole.update({ where: { id: existing.id }, data: fields, select: roleSelect })
      : await tx.targetRole.create({ data: { userId, ...fields }, select: roleSelect });
    await tx.targetRole.updateMany({ where: { userId, NOT: { id: role.id } }, data: { isActive: false } });

    const profile: Prisma.UserUpdateInput = {};
    if (input.hoursPerWeek) profile.hoursPerWeek = input.hoursPerWeek;
    if (input.horizonWeeks) profile.targetDate = new Date(Date.now() + input.horizonWeeks * 7 * 86_400_000);
    if (Object.keys(profile).length) await tx.user.update({ where: { id: userId }, data: profile });
    return role;
  }, { maxWait: 10_000, timeout: 30_000 });
}

/**
 * Target role for an analysis: reuse the user's role with this title, or create one
 * linked to a matching template. Doesn't change which role is active.
 */
export async function findOrCreateTargetRole(client: Client, userId: string, title: string | null) {
  if (!title) return null;
  const existing = await client.targetRole.findFirst({
    where: { userId, title: { equals: title, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const tracks = await client.roleTrack.findMany({ select: { id: true, slug: true, title: true, aliases: true } });
  const hasActive = (await client.targetRole.count({ where: { userId, isActive: true } })) > 0;
  const created = await client.targetRole.create({
    data: { userId, title, roleTrackId: matchRoleTrack(title, tracks)?.id ?? null, isActive: !hasActive },
    select: { id: true },
  });
  return created.id;
}

export async function getActiveTargetRole(userId: string) {
  return db.targetRole.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "desc" },
    select: roleSelect,
  });
}

const roleSelect = {
  id: true,
  title: true,
  seniority: true,
  industry: true,
  location: true,
  salaryExpectation: true,
  hoursPerWeek: true,
  horizonWeeks: true,
  isActive: true,
  roleTrack: { select: { id: true, slug: true, title: true, family: true } },
} satisfies Prisma.TargetRoleSelect;
