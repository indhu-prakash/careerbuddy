import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { reviewPlan } from "@/lib/progress/review";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressTracker, type ChangeSummary } from "@/features/progress/components/ProgressTracker";

// F6: log progress, see replan triggers, and review/accept a revised plan.
export default async function ProgressPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [{ plan, triggers }, pending, skills, events] = await Promise.all([
    reviewPlan(user.id),
    db.learningPlan.findFirst({
      where: { userId: user.id, status: "draft", parentId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true, version: true, reason: true, changeSummary: true },
    }),
    db.userSkill.findMany({
      where: { userId: user.id },
      orderBy: { skill: { name: "asc" } },
      select: { skillId: true, level: true, skill: { select: { name: true } } },
    }),
    db.progressEvent.findMany({
      where: { userId: user.id },
      orderBy: { occurredAt: "desc" },
      take: 30,
      select: {
        id: true,
        kind: true,
        hours: true,
        value: true,
        note: true,
        occurredAt: true,
        skill: { select: { name: true } },
        task: { select: { title: true } },
      },
    }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="Progress"
        title="Progress and plan adjustments"
        description="Your activity updates skill levels. When you fall behind, get ahead, master a skill or struggle with one, you can rebuild the remaining weeks — nothing changes until you accept it."
      />
      <ProgressTracker
        data={{
          planId: plan?.id ?? null,
          triggers: triggers.map(({ kind, reason }) => ({ kind, reason })),
          pending: pending
            ? { ...pending, changeSummary: pending.changeSummary as ChangeSummary | null }
            : null,
          skills: skills.map((s) => ({ skillId: s.skillId, name: s.skill.name, level: s.level })),
          events: events.map((e) => ({
            ...e,
            occurredAt: e.occurredAt.toISOString(),
            skill: e.skill?.name ?? null,
            task: e.task?.title ?? null,
          })),
        }}
      />
    </main>
  );
}
