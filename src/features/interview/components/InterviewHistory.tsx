import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { KIND_LABELS, type HistoryItem } from "../types";

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  completed: { label: "Completed", tone: "success" },
  in_progress: { label: "In progress", tone: "warning" },
  abandoned: { label: "Abandoned", tone: "neutral" },
};

/** Past sessions, newest first, each linking to its runner or report. */
export function InterviewHistory({ sessions }: { sessions: HistoryItem[] }) {
  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">No interviews yet. Your sessions and scores will appear here.</p>;
  }
  return (
    <ul className="grid gap-3">
      {sessions.map((s) => {
        const status = STATUS[s.status] ?? STATUS.abandoned;
        return (
          <li key={s.id}>
            <Link href={`/interview/${s.id}`} className="block">
              <Card interactive className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.targetRoleTitle ?? "Mock interview"}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <span>{KIND_LABELS[s.kind] ?? s.kind}</span>
                    <span>
                      · {s.answered}/{s.questionCount} answered
                    </span>
                    <span>· {new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                {s.overallScore != null && (
                  <div className="shrink-0 text-right">
                    <div className="font-display text-2xl font-bold">{Math.round(s.overallScore)}</div>
                    <div className="text-xs text-muted-foreground">/ 100</div>
                  </div>
                )}
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
