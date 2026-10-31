import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPrimaryResume } from "@/lib/intake/resume";
import { listInventory } from "@/lib/intake/skills";
import { getActiveTargetRole } from "@/lib/intake/target-role";
import { PageHeader } from "@/components/ui/PageHeader";
import { OnboardingWizard } from "@/features/onboarding/components/OnboardingWizard";

// F1: resume -> review skills -> target role and time budget. Re-entrant: returning
// users land on the review step with their saved skills.
export default async function OnboardingPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const [resume, skills, role, tracks, user] = await Promise.all([
    getPrimaryResume(session.id),
    listInventory(session.id),
    getActiveTargetRole(session.id),
    db.roleTrack.findMany({ orderBy: { title: "asc" }, select: { slug: true, title: true, family: true } }),
    db.user.findUnique({ where: { id: session.id }, select: { hoursPerWeek: true } }),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="Get started"
        title="Set up your profile"
        description="Three quick steps: your resume, the skills it shows, and the role you're aiming for."
      />
      <OnboardingWizard
        hasResume={!!resume}
        initialSkills={skills}
        roleTracks={tracks}
        defaults={{
          title: role?.title ?? "",
          seniority: role?.seniority ?? null,
          industry: role?.industry ?? null,
          location: role?.location ?? null,
          salaryExpectation: role?.salaryExpectation ?? null,
          hoursPerWeek: role?.hoursPerWeek ?? user?.hoursPerWeek ?? 8,
          horizonWeeks: role?.horizonWeeks ?? 8,
          roleTrackSlug: role?.roleTrack?.slug ?? null,
        }}
      />
    </main>
  );
}
