import { withUser } from "@/lib/api";
import { db } from "@/lib/db";

// The seeded role templates, for the manual picker when a title doesn't match one.
export const GET = withUser(async () => {
  const tracks = await db.roleTrack.findMany({
    orderBy: [{ family: "asc" }, { title: "asc" }],
    select: { slug: true, title: true, family: true, description: true },
  });
  return Response.json({ roleTracks: tracks });
});
