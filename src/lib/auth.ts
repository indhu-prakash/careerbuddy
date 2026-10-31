import "server-only";
import { db } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Not signed in");
  }
}

/**
 * The signed-in user's id and email from the verified Supabase session, or null.
 * This is the only trusted source of the user's identity: never take a user id
 * from the request body or query string.
 */
export async function getSessionUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
}

/**
 * Resolve the signed-in user and make sure their app row exists (created on
 * first sign-in). Throws UnauthorizedError when there is no valid session.
 */
export async function requireUser() {
  const session = await getSessionUser();
  if (!session) throw new UnauthorizedError();
  return db.user.upsert({
    where: { id: session.id },
    create: { id: session.id, email: session.email },
    update: {},
  });
}
