import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getDashboard } from "@/lib/progress/dashboard";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { MicIcon, TargetIcon } from "@/components/ui/icons";
import { ModuleGrid } from "@/features/dashboard/components/ModuleGrid";
import { ProgressOverview } from "@/features/dashboard/components/ProgressOverview";

// Signed-in home (F6): readiness, plan progress, replan prompts, then every module.
export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const data = await getDashboard(user.id);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="Dashboard"
        title={data.name ? `Welcome back, ${data.name}` : "Welcome back"}
        description="Your readiness, this week's tasks and what changed since last time."
      />
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/analyze">
          <TargetIcon className="size-4" /> Analyze job descriptions
        </ButtonLink>
        <ButtonLink href="/interview" variant="outline">
          <MicIcon className="size-4" /> Start a mock interview
        </ButtonLink>
      </div>
      <div className="mt-8">
        <ProgressOverview data={data} />
      </div>
      <h2 className="mt-12 mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Your modules</h2>
      <ModuleGrid />
    </main>
  );
}
