import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { listSessions } from "@/lib/interview/sessions";
import { InterviewHistory } from "@/features/interview/components/InterviewHistory";
import { StartInterviewForm } from "@/features/interview/components/StartInterviewForm";
import { toClient } from "@/features/interview/types";

// F5: start a mock interview targeted at the user's role and gaps, and see past sessions.
export default async function InterviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [roles, latest, sessions] = await Promise.all([
    db.targetRole.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, title: true, _count: { select: { gapAnalyses: true } } },
    }),
    db.gapAnalysis.findFirst({
      where: { userId: user.id, targetRoleId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { targetRoleId: true },
    }),
    listSessions(user.id),
  ]);
  const defaultRoleId = roles.find((r) => r.id === latest?.targetRoleId)?.id ?? null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="Mock interview"
        title="Mock interviews"
        description="Questions are generated for your target role and its biggest skill gaps. Each answer is scored against a rubric as you go, and the scores update your skill levels."
      />
      <div className="mt-6">
        <StartInterviewForm
          roles={roles.map((r) => ({ id: r.id, title: r.title, hasAnalysis: r._count.gapAnalyses > 0 }))}
          defaultRoleId={defaultRoleId}
        />
      </div>
      <ButtonLink href="/interview/practice" variant="ghost" size="sm" className="mt-3">
        Or practice a single question without saving
      </ButtonLink>
      <h2 className="mt-10 mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">History</h2>
      <InterviewHistory sessions={toClient(sessions)} />
    </main>
  );
}
