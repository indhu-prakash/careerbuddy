import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getRoadmap } from "@/lib/roadmap/service";
import { PageHeader } from "@/components/ui/PageHeader";
import { toClient } from "@/features/plan/types";
import { Roadmap } from "@/features/roadmap/components/Roadmap";

// How the journey fits together: stage status, next best action and the plan timeline.
export default async function RoadmapPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const data = await getRoadmap(user.id);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="Roadmap"
        title="Your career roadmap"
        description="Every step from profile to job-ready, with live status from your saved progress, and your plan week by week."
      />
      <div className="mt-8">
        <Roadmap data={toClient(data)} />
      </div>
    </main>
  );
}
