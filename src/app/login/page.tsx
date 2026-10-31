import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogoMark } from "@/components/brand/Logo";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/login?error=missing_email");

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  redirect(error ? "/login?error=send_failed" : "/login?sent=1");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  if (await getSessionUser().catch(() => null)) redirect("/dashboard");
  const { sent, error } = await searchParams;
  return (
    <main className="relative grid min-h-[calc(100dvh-57px)] place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden className="hero-backdrop absolute inset-0 -z-10" />
      <Card className="w-full max-w-sm p-6 shadow-lift sm:p-8">
        <LogoMark size={44} />
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight">
          {sent ? "Check your inbox" : "Sign in to CareerBuddy"}
        </h1>
        {sent ? (
          <p className="mt-2 text-muted-foreground">
            We sent you a sign-in link. Open it on this device to continue to your dashboard.
          </p>
        ) : (
          <>
            <p className="mt-2 text-muted-foreground">No password needed. We&apos;ll email you a one-time link.</p>
            <form action={sendMagicLink} className="mt-6 grid gap-4">
              <Field label="Email">
                <Input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
              </Field>
              <Button type="submit" className="w-full sm:w-full">
                Email me a sign-in link
              </Button>
            </form>
          </>
        )}
        {error && (
          <Alert tone="danger" className="mt-4">
            {error === "missing_email"
              ? "Enter your email address."
              : error === "callback_failed"
                ? "That sign-in link is invalid or has expired. Request a new one."
                : "We couldn't send the link. Try again in a minute."}
          </Alert>
        )}
      </Card>
    </main>
  );
}
