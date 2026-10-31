import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isUuid } from "@/lib/api";
import { getGapAnalysisView } from "@/lib/analysis/view";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { GapMapView } from "@/features/analysis/components/GapMapView";

export default async function GapMapPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const analysis = await getGapAnalysisView(user.id, id);
  if (!analysis) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader eyebrow="Skill gap" title="Gap map" description="Saved analysis with the evidence behind every skill." />
      <div className="mt-4 print:hidden">
        <ButtonLink href="/gap-map" variant="ghost" size="sm">
          ← All gap maps
        </ButtonLink>
      </div>
      <div className="mt-4">
        <GapMapView data={analysis} />
      </div>
    </main>
  );
}
