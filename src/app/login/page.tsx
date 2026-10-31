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
  if (!error) redirect("/login?sent=1");

  console.error("[login] magic link", error.status, error.code, error.message);
  // Supabase's built-in mailer allows only a few emails per hour per project.
  if (error.status === 429 || error.code === "over_email_send_rate_limit") redirect("/login?error=rate_limited");
  // Built-in mailer only delivers to project team members until custom SMTP is configured.
  if (error.code === "email_address_not_authorized") redirect("/login?error=not_authorized");
  redirect("/login?error=send_failed");
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_email: "Enter your email address.",
  callback_failed: "That sign-in link is invalid or has expired. Request a new one.",
  rate_limited:
    "Too many sign-in emails were sent recently. Please wait up to an hour, then request one new link.",
  not_authorized: "We can't send sign-in emails to this address yet. Contact the site owner.",
  send_failed: "We couldn't send the link. Try again in a minute.",
};

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
            {Object.hasOwn(ERROR_MESSAGES, error) ? ERROR_MESSAGES[error] : ERROR_MESSAGES.send_failed}
          </Alert>
        )}
      </Card>
    </main>
  );
}
