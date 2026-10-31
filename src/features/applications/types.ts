import type { listApplications, getApplication, listLinkOptions } from "@/lib/applications/service";

// Prisma rows after JSON serialization: Date fields arrive as ISO strings.
type Jsonify<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Jsonify<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T;

export type ApplicationRow = Jsonify<Awaited<ReturnType<typeof listApplications>>[number]>;
export type ApplicationDetail = Jsonify<NonNullable<Awaited<ReturnType<typeof getApplication>>>>;
export type ApplicationEventRow = ApplicationDetail["events"][number];
export type LinkOptions = Jsonify<Awaited<ReturnType<typeof listLinkOptions>>>;
