import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getPrimaryResume } from "@/lib/intake/resume";
import { getActiveTargetRole } from "@/lib/intake/target-role";
import { PageHeader } from "@/components/ui/PageHeader";
import { GapAnalyzer } from "@/features/analysis/components/GapAnalyzer";

// F2: compare the saved (or a new) resume against real job descriptions.
export default async function AnalyzePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [resume, role] = await Promise.all([getPrimaryResume(user.id), getActiveTargetRole(user.id)]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="Skill gap"
        title="Skill-gap analysis"
        description="Compare your profile against real job descriptions. Each resume and JD is read by the AI once; results are saved to your gap map."
      />
      <GapAnalyzer
        savedResume={resume ? { fileName: resume.fileName, createdAt: resume.createdAt.toISOString() } : null}
        activeRoleTitle={role?.title ?? null}
      />
    </main>
  );
}
