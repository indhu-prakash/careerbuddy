import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { listApplications, listLinkOptions } from "@/lib/applications/service";
import { ApplicationTracker } from "@/features/applications/components/ApplicationTracker";
import type { ApplicationRow, LinkOptions } from "@/features/applications/types";

// Keep the props shape identical to the API's JSON (dates as ISO strings).
const toJson = <T,>(value: unknown) => JSON.parse(JSON.stringify(value)) as T;

// F7: log applications, move them through stages, and see which kinds get responses.
export default async function ApplicationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [applications, options] = await Promise.all([listApplications(user.id), listLinkOptions(user.id)]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="Applications"
        title="Application tracker"
        description="Track every application and its replies. Response rates by source, role and match score show where to aim next."
      />
      <ApplicationTracker initial={toJson<ApplicationRow[]>(applications)} options={toJson<LinkOptions>(options)} />
    </main>
  );
}
