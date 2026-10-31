import { withUser } from "@/lib/api";
import { buildRoadmap, getRoadmap } from "@/lib/roadmap/service";

// Plan creation and project suggestion each make one AI call; free models can take a minute.
export const maxDuration = 300;

// Run the automatable roadmap steps (plan, then projects), skipping ones already done.
// Always 200: each step reports ran / skipped / failed on its own, plus the updated roadmap.
export const POST = withUser(async (user) => {
  const { steps } = await buildRoadmap(user.id);
  return Response.json({ steps, roadmap: await getRoadmap(user.id) });
});
