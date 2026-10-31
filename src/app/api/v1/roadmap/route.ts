import { withUser } from "@/lib/api";
import { getRoadmap } from "@/lib/roadmap/service";

// Journey stages, next best action and the active plan's week-by-week timeline.
export const GET = withUser(async (user) => Response.json(await getRoadmap(user.id)));
