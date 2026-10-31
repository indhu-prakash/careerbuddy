import { getSessionUser } from "@/lib/auth";
import { LandingPage } from "@/features/landing/components/LandingPage";

// Product landing page at "/", shown to everyone. Signed-in users get "Go to dashboard"
// buttons that lead to /dashboard.
export default async function Home() {
  const user = await getSessionUser().catch(() => null);
  return <LandingPage signedIn={Boolean(user)} />;
}
