"use client";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { APPLICATION_STATUSES } from "@/lib/scoring/applications";
import { formatDate, pct, STATUS_LABELS, STATUS_TONES } from "../labels";
import type { ApplicationRow } from "../types";

/** Kanban by status. Click a card to open it; stage changes happen in the detail panel. */
export function ApplicationBoard({
  applications,
  selectedId,
  onSelect,
}: {
  applications: ApplicationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid auto-cols-[minmax(14rem,1fr)] grid-flow-col gap-3">
        {APPLICATION_STATUSES.map((status) => {
          const items = applications.filter((a) => a.status === status);
          return (
            <section key={status} className="grid content-start gap-2 rounded-xl bg-muted/50 p-2">
              <header className="flex items-center justify-between px-1 py-1">
                <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </header>
              {items.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelect(a.id)}
                  className={cn(
                    "rounded-lg border border-border bg-card p-3 text-left text-sm shadow-soft transition hover:border-primary/60",
                    selectedId === a.id && "border-primary ring-2 ring-primary/20",
                  )}
                >
                  <p className="font-medium">{a.roleTitle}</p>
                  <p className="text-muted-foreground">{a.company}</p>
                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span>{formatDate(a.appliedAt)}</span>
                    {a.matchScore != null && <span>Match {pct(a.matchScore)}</span>}
                    {a.referral && <span>Referral</span>}
                  </p>
                </button>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
