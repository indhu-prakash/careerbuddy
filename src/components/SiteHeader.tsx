import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ButtonLink, buttonClasses } from "@/components/ui/Button";
import { UserMenu } from "@/components/UserMenu";

// Signed-in users get app navigation; visitors get landing-page anchors.
const APP_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/onboarding", label: "Profile" },
  { href: "/gap-map", label: "Skill gap" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/plan", label: "Plan" },
  { href: "/projects", label: "Projects" },
  { href: "/interview", label: "Interviews" },
  { href: "/progress", label: "Progress" },
  { href: "/applications", label: "Applications" },
];

const LANDING_NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#privacy", label: "Privacy" },
  { href: "/#faq", label: "FAQ" },
];

// Sticky, translucent top bar. App nav wraps onto a second row on narrow phones.
export async function SiteHeader() {
  const user = await getSessionUser().catch(() => null);
  const nav = user ? APP_NAV : LANDING_NAV;

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <nav className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 sm:px-8 lg:px-12 2xl:px-16">
        <Link href="/" aria-label="CareerBuddy home" className="rounded-lg">
          <Logo size={30} />
        </Link>
        <ul
          className={
            user
              ? "order-last -mx-2 flex w-full gap-1 overflow-x-auto text-sm md:order-none md:w-auto"
              : "hidden gap-1 text-sm md:flex"
          }
        >
          {nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-lg px-2 py-1.5 whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <ThemeToggle />
          {user ? (
            <UserMenu email={user.email ?? ""} />
          ) : (
            <>
              {/* Wrapper hides it on phones; `hidden` on the link itself would fight its inline-flex. */}
              <span className="hidden sm:block">
                <Link href="/login" className={buttonClasses({ variant: "ghost", size: "sm" })}>
                  Sign in
                </Link>
              </span>
              <ButtonLink href="/login" size="sm">
                Get started
              </ButtonLink>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
