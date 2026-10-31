"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Avatar with the email's first letter; opens a menu with the account email, Home and Sign out.
export function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (email.trim()[0] ?? "?").toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${email}`}
        className="grid size-9 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground shadow-soft transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {initial}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-card shadow-lift"
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-sm font-bold text-primary">
              {initial}
            </span>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Signed in as</div>
              <div className="truncate text-sm font-medium">{email}</div>
            </div>
          </div>
          <Link
            href="/dashboard"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm hover:bg-muted"
          >
            Home
          </Link>
          <form action="/auth/signout" method="post" className="border-t border-border">
            <button type="submit" role="menuitem" className="w-full px-4 py-2.5 text-left text-sm text-danger hover:bg-muted">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
