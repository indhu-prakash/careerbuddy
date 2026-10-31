import { isUuid, notFound, withUser } from "@/lib/api";
import { getGapAnalysisView } from "@/lib/analysis/view";

// One saved gap analysis (no model call). Other users' analyses are 404.
export const GET = withUser<{ params: Promise<{ id: string }> }>(async (user, _request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const analysis = await getGapAnalysisView(user.id, id);
  return analysis ? Response.json(analysis) : notFound();
});
