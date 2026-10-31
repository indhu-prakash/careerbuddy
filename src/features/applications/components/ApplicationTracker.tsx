"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import type { ApplicationRow, LinkOptions } from "../types";
import { ApplicationBoard } from "./ApplicationBoard";
import { ApplicationDetailPanel } from "./ApplicationDetailPanel";
import { ApplicationForm } from "./ApplicationForm";
import { ApplicationInsightsView } from "./ApplicationInsightsView";
import { ApplicationTable } from "./ApplicationTable";

type View = "board" | "table" | "insights";
const VIEWS: { id: View; label: string }[] = [
  { id: "board", label: "Board" },
  { id: "table", label: "Table" },
  { id: "insights", label: "Insights" },
];

export function ApplicationTracker({ initial, options }: { initial: ApplicationRow[]; options: LinkOptions }) {
  const [applications, setApplications] = useState(initial);
  const [view, setView] = useState<View>("board");
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Bumped on every change so the insights tab refetches.
  const [version, setVersion] = useState(0);

  const upsert = (app: ApplicationRow) => {
    setApplications((list) =>
      list.some((a) => a.id === app.id) ? list.map((a) => (a.id === app.id ? app : a)) : [app, ...list],
    );
    setVersion((v) => v + 1);
  };

  return (
    <div className="mt-8 grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" className="inline-flex w-fit rounded-lg border border-border bg-card p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === v.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        {!adding && (
          <Button
            onClick={() => {
              setAdding(true);
              setSelectedId(null);
            }}
          >
            Add application
          </Button>
        )}
      </div>

      {adding && (
        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold">New application</h2>
          <ApplicationForm
            options={options}
            onCancel={() => setAdding(false)}
            onSaved={(app) => {
              upsert(app);
              setAdding(false);
            }}
          />
        </Card>
      )}

      {selectedId && view !== "insights" && (
        <ApplicationDetailPanel
          id={selectedId}
          options={options}
          onChanged={upsert}
          onClose={() => setSelectedId(null)}
          onDeleted={(id) => {
            setApplications((list) => list.filter((a) => a.id !== id));
            setSelectedId(null);
            setVersion((v) => v + 1);
          }}
        />
      )}

      {view === "insights" ? (
        <ApplicationInsightsView version={version} />
      ) : applications.length === 0 ? (
        <Card className="text-center">
          <p className="font-medium">No applications yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Log each application and update its stage as you hear back. After a few outcomes you&apos;ll see which
            sources, roles and match scores get responses.
          </p>
        </Card>
      ) : view === "board" ? (
        <ApplicationBoard applications={applications} selectedId={selectedId} onSelect={setSelectedId} />
      ) : (
        <ApplicationTable applications={applications} selectedId={selectedId} onSelect={setSelectedId} />
      )}
    </div>
  );
}
