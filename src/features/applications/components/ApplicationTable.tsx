"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { APPLICATION_STATUSES, SOURCE_LABELS } from "@/lib/scoring/applications";
import { formatDate, pct, STATUS_LABELS, STATUS_TONES } from "../labels";
import type { ApplicationRow } from "../types";

type SortKey = "company" | "roleTitle" | "status" | "source" | "matchScore" | "appliedAt" | "respondedAt";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "roleTitle", label: "Role" },
  { key: "status", label: "Status" },
  { key: "source", label: "Source" },
  { key: "matchScore", label: "Match" },
  { key: "appliedAt", label: "Applied" },
  { key: "respondedAt", label: "First response" },
];

function sortValue(a: ApplicationRow, key: SortKey): string | number | null {
  if (key === "status") return APPLICATION_STATUSES.indexOf(a.status);
  if (key === "matchScore") return a.matchScore;
  const v = a[key];
  return v == null ? null : String(v).toLowerCase();
}

/** Sortable table; empty values always sort last. */
export function ApplicationTable({
  applications,
  selectedId,
  onSelect,
}: {
  applications: ApplicationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "appliedAt", dir: -1 });

  const rows = useMemo(
    () =>
      [...applications].sort((x, y) => {
        const a = sortValue(x, sort.key);
        const b = sortValue(y, sort.key);
        if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
        return (a < b ? -1 : a > b ? 1 : 0) * sort.dir;
      }),
    [applications, sort],
  );

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                <button type="button" onClick={() => toggle(c.key)} className="w-full px-3 py-2 text-left font-medium hover:text-foreground">
                  {c.label}
                  {sort.key === c.key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr
              key={a.id}
              onClick={() => onSelect(a.id)}
              className={cn(
                "cursor-pointer border-t border-border hover:bg-muted/40",
                selectedId === a.id && "bg-primary-soft/40",
              )}
            >
              <td className="px-3 py-2 font-medium">{a.company}</td>
              <td className="px-3 py-2">{a.roleTitle}</td>
              <td className="px-3 py-2">
                <Badge tone={STATUS_TONES[a.status]}>{STATUS_LABELS[a.status]}</Badge>
              </td>
              <td className="px-3 py-2">{a.source ? SOURCE_LABELS[a.source] : "–"}</td>
              <td className="px-3 py-2">{pct(a.matchScore)}</td>
              <td className="px-3 py-2">{formatDate(a.appliedAt)}</td>
              <td className="px-3 py-2">{formatDate(a.respondedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
