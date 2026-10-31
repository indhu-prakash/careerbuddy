import { isUuid, notFound, withUser } from "@/lib/api";
import { getPlan } from "@/lib/plan/service";

// One plan version with weeks, tasks, coverage and deferred gaps. Other users' plans are 404.
export const GET = withUser<{ params: Promise<{ id: string }> }>(async (user, _request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const plan = await getPlan(user.id, id);
  return plan ? Response.json(plan) : notFound();
});
