import Link from "next/link";
import { FEATURES, type Feature } from "@/features/catalog";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ArrowRightIcon } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";

/** Home-page tiles for every feature: live ones link, the rest show "Coming soon". */
export function ModuleGrid() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f) => (
        <li key={f.id}>
          {f.href ? (
            <Link href={f.href} className="group block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-ring">
              <Card interactive className="h-full">
                <TileBody feature={f} />
              </Card>
            </Link>
          ) : (
            <Card className="h-full border-dashed bg-card/60 shadow-none">
              <TileBody feature={f} />
            </Card>
          )}
        </li>
      ))}
    </ul>
  );
}

function TileBody({ feature: f }: { feature: Feature }) {
  const live = Boolean(f.href);
  const Icon = f.icon;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "grid size-10 place-items-center rounded-xl",
            live ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon />
        </span>
        {live ? <Badge tone="success">Live</Badge> : <Badge>Coming soon</Badge>}
      </div>
      <h2 className={cn("mt-4 font-display text-lg font-bold", !live && "text-muted-foreground")}>{f.name}</h2>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{f.title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{f.summary}</p>
      {live && (
        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-primary">
          Open <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </div>
  );
}
