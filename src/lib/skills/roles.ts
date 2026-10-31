// Match a job title from a JD (or typed by the user) to a role track in the taxonomy.
import { normalizeSkillTerm } from "./normalize";

export type CatalogRole = { id: string; slug: string; title: string; aliases: string[] };

const SENIORITY =
  /\b(senior|sr|junior|jr|lead|principal|staff|chief|head|associate|intern|trainee|entry[- ]level|mid[- ]level|graduate|i{1,3}|iv|[1-4])\b/g;

/**
 * Title without the company suffix the model sometimes includes
 * ("Full Stack Engineer at Globex" -> "Full Stack Engineer").
 */
export function cleanRoleTitle(title: string, company?: string | null): string {
  let t = title.trim();
  if (company?.trim()) {
    const c = company.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`\\s*(?:at|@|-|–|—|,|\\|)\\s*${c}\\s*$`, "i"), "");
  }
  return t.replace(/\s*\(.*?\)\s*$/, "").trim() || title.trim();
}

/** Comparison key: lowercase, no seniority words, no spaces or punctuation. */
export function roleKey(title: string): string {
  return normalizeSkillTerm(title).replace(SENIORITY, " ").replace(/[^a-z0-9]+/g, "");
}

export function matchRoleTrack<T extends CatalogRole>(title: string, tracks: T[]): T | undefined {
  const key = roleKey(title);
  if (!key) return undefined;
  return tracks.find((t) => [t.title, t.slug, ...t.aliases].some((name) => roleKey(name) === key));
}
