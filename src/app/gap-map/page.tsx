import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

// F2: saved gap analyses, newest first. Opening one never calls the AI again.
export default async function GapMapListPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const analyses = await db.gapAnalysis.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      matchScore: true,
      jdCount: true,
      targetRole: { select: { title: true } },
      _count: { select: { items: { where: { status: "missing" } } } },
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="Skill gap"
        title="Your gap maps"
        description="Every analysis you've run, with the evidence behind it."
      />
      <div className="mt-6">
        <ButtonLink href="/analyze">Run a new analysis</ButtonLink>
      </div>
      {analyses.length === 0 ? (
        <Card className="mt-6 text-muted-foreground">No analyses yet. Run one to see your skill-gap map.</Card>
      ) : (
        <ul className="mt-6 grid gap-3">
          {analyses.map((a) => (
            <li key={a.id}>
              <Link href={`/gap-map/${a.id}`}>
                <Card interactive className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{a.targetRole?.title ?? "Skill-gap analysis"}</div>
                    <div className="text-sm text-muted-foreground">
                      {a.createdAt.toLocaleDateString()} · {a.jdCount} JD{a.jdCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="danger">{a._count.items} missing</Badge>
                    <Badge tone="primary">{Math.round(a.matchScore * 100)}% match</Badge>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
