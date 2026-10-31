import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { loadGapContext } from "@/lib/analysis/load";
import { getActivePlan, listPlans } from "@/lib/plan/service";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlanView } from "@/features/plan/components/PlanView";
import { toClient } from "@/features/plan/types";

// F3: the active week-by-week learning plan, or a form to create one.
export default async function PlanPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [plan, plans, ctx] = await Promise.all([getActivePlan(user.id), listPlans(user.id), loadGapContext(user.id)]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="Learning plan"
        title="Your week-by-week plan"
        description="Skills, order and hours are scheduled from your skill gaps; tick off tasks and log hours as you go."
      />
      <PlanView
        initialPlan={plan ? toClient(plan) : null}
        plans={toClient(plans)}
        hasAnalysis={!!ctx}
        defaults={ctx?.budget ?? { weeks: 8, hoursPerWeek: 8 }}
      />
    </main>
  );
}
