import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";

export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="px-4 py-20 sm:px-8 sm:py-28 lg:px-12 2xl:px-16">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#4f46e5] via-[#4338ca] to-[#0f766e] px-6 py-14 text-center text-white shadow-lift sm:px-12 sm:py-20">
        {/* Fixed brand colors: this banner looks the same in both themes, with white text at ≥ 4.5:1. */}
        <div aria-hidden className="absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="absolute -bottom-24 -left-24 size-72 rounded-full bg-[#f59e0b]/20 blur-2xl" />
        <h2 className="relative font-display text-3xl font-extrabold tracking-tight text-balance sm:text-5xl">
          Your next role is a plan away.
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/85">
          Sign in with your email. No password, no credit card. See your first skill-gap map in minutes.
        </p>
        <Link
          href={signedIn ? "/dashboard" : "/login"}
          className="relative mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-white px-7 font-semibold text-[#3730a3] shadow-soft transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {signedIn ? "Go to dashboard" : "Start my pivot"} <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </section>
  );
}
