import { notFound, withUser } from "@/lib/api";
import { getActivePlan } from "@/lib/plan/service";

// The user's current active plan, or 404 if they have none yet.
export const GET = withUser(async (user) => {
  const plan = await getActivePlan(user.id);
  return plan ? Response.json(plan) : notFound();
});
