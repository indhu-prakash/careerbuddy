import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listProjects } from "@/lib/projects/service";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProjectsView } from "@/features/projects/components/ProjectsView";
import { toClient } from "@/features/plan/types";

// F4: portfolio projects that together cover the biggest gaps, with a coverage view.
export default async function ProjectsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const data = await listProjects(user.id);
  const plan = data.gapAnalysisId
    ? await db.learningPlan.findFirst({
        where: { userId: user.id, gapAnalysisId: data.gapAnalysisId, status: "active" },
        select: { id: true },
      })
    : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="Portfolio"
        title="Portfolio projects"
        description="Concrete projects that prove your gap skills and give you stories for interviews."
      />
      <ProjectsView initial={toClient(data)} planId={plan?.id ?? null} hasAnalysis={!!data.gapAnalysisId} />
    </main>
  );
}
