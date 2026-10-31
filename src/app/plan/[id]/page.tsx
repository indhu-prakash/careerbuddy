import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isUuid } from "@/lib/api";
import { getPlan, listPlans } from "@/lib/plan/service";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlanView } from "@/features/plan/components/PlanView";
import { toClient } from "@/features/plan/types";

// F3: one plan version (earlier versions are read-only).
export default async function PlanVersionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const plan = isUuid(id) ? await getPlan(user.id, id) : null;
  if (!plan) notFound();
  const plans = await listPlans(user.id);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="Learning plan"
        title={`Plan version ${plan.version}`}
        description={plan.status === "active" ? "This is your active plan." : "An earlier version, kept for reference."}
      />
      <PlanView
        initialPlan={toClient(plan)}
        plans={toClient(plans)}
        hasAnalysis
        defaults={{ weeks: plan.durationWeeks, hoursPerWeek: plan.hoursPerWeek }}
      />
    </main>
  );
}
