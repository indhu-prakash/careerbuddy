import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isUuid } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSessionView } from "@/lib/interview/sessions";
import { InterviewRunner } from "@/features/interview/components/InterviewRunner";
import { toClient } from "@/features/interview/types";

// F5: one saved mock interview. Answer questions in order, then see the session report.
export default async function InterviewSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const session = isUuid(id) ? await getSessionView(user.id, id) : null;
  if (!session) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="Mock interview"
        title={session.status === "in_progress" ? "Interview in progress" : "Interview report"}
        description={
          session.status === "in_progress"
            ? "Each answer is scored against the rubric shown with the question as soon as you submit it."
            : `Started ${session.createdAt.toLocaleDateString()}.`
        }
      />
      <InterviewRunner initial={toClient(session)} />
    </main>
  );
}
