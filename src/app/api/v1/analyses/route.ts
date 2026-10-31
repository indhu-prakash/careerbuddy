import { requireUser, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";

// The signed-in user's saved gap analyses, newest first.
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }

  const analyses = await db.gapAnalysis.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      matchScore: true,
      jdCount: true,
      model: true,
      targetRole: { select: { id: true, title: true } },
      _count: { select: { items: { where: { status: "missing" } } } },
    },
  });

  return Response.json({
    analyses: analyses.map(({ _count, ...a }) => ({ ...a, missingSkills: _count.items })),
  });
}
