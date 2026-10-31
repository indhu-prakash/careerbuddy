import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export function LandingFooter({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="border-t border-border">
      <div className="flex flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12 2xl:px-16">
        <div>
          <Logo size={26} />
          <p className="mt-2 text-sm text-muted-foreground">Your career pivot, planned.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="#features" className="hover:text-foreground">
            Features
          </Link>
          <Link href="#how-it-works" className="hover:text-foreground">
            How it works
          </Link>
          <Link href="#scoring" className="hover:text-foreground">
            Scoring
          </Link>
          <Link href="#privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="#faq" className="hover:text-foreground">
            FAQ
          </Link>
          <Link href={signedIn ? "/dashboard" : "/login"} className="hover:text-foreground">
            {signedIn ? "Dashboard" : "Sign in"}
          </Link>
        </nav>
      </div>
      <p className="pb-8 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} CareerBuddy</p>
    </footer>
  );
}
