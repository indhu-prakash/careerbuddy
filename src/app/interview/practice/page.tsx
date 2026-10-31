import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PracticeInterview } from "@/features/interview/components/PracticeInterview";

// F5 practice: answer one question by voice or text and get a rubric score. Nothing is saved.
export default async function InterviewPracticePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const role = await db.targetRole.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { createdAt: "desc" },
    select: { title: true },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="Mock interview"
        title="Quick practice"
        description="Answer one question (recordings are transcribed, not stored), check the transcript, then get scored against the rubric. Nothing here is saved."
      />
      <ButtonLink href="/interview" variant="outline" className="mt-4">
        Start a full mock interview instead
      </ButtonLink>
      <PracticeInterview defaultTargetRole={role?.title ?? ""} />
    </main>
  );
}
