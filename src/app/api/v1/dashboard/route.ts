import { withUser } from "@/lib/api";
import { getDashboard } from "@/lib/progress/dashboard";

// F6: readiness, plan progress, replan triggers, streak and activity (no AI calls).
export const GET = withUser(async (user) => Response.json(await getDashboard(user.id)));
