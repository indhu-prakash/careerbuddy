import { isUuid, notFound, withUser } from "@/lib/api";
import { listProjects } from "@/lib/projects/service";

// Projects for a gap analysis (?gapAnalysisId=, default: the latest) with the top-gap coverage view.
export const GET = withUser(async (user, request) => {
  const gapAnalysisId = new URL(request.url).searchParams.get("gapAnalysisId") ?? undefined;
  if (gapAnalysisId !== undefined && !isUuid(gapAnalysisId)) return notFound();
  const result = await listProjects(user.id, { gapAnalysisId });
  if (gapAnalysisId && !result.gapAnalysisId) return notFound();
  return Response.json(result);
});
