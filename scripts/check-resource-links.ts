// Checks every learning-resource URL in prisma/seed/data/skills.json against the live web.
// Run with: npm run seed:check-links
// Exit code 1 if any link is broken (4xx other than 401/403/429, 5xx, or network error).
// 401/403/429 are reported as "blocked": the site refuses scripted requests, so check those by hand.
import { loadCatalog } from "../prisma/seed/catalog";

const TIMEOUT_MS = 20_000;
const CONCURRENCY = 8;

type Result = { skill: string; url: string; status: number | "error"; finalUrl?: string; note?: string };

async function check(url: string): Promise<Omit<Result, "skill" | "url">> {
  const headers = { "User-Agent": "Mozilla/5.0 (career-pivot-coach link checker)", Accept: "text/html,*/*" };
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow", headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    // Some servers reject HEAD; retry with GET before calling it broken.
    if (res.status === 405 || res.status === 404 || res.status >= 500) {
      res = await fetch(url, { method: "GET", redirect: "follow", headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      await res.body?.cancel();
    }
    return { status: res.status, finalUrl: res.url !== url ? res.url : undefined };
  } catch (err) {
    return { status: "error", note: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const { skills } = loadCatalog();
  const queue = skills.flatMap((s) => s.resources.map((r) => ({ skill: s.slug, url: r.url })));
  const results: Result[] = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        results.push({ ...item, ...(await check(item.url)) });
      }
    }),
  );

  const blocked = results.filter((r) => r.status === 401 || r.status === 403 || r.status === 429);
  const broken = results.filter((r) => r.status === "error" || (typeof r.status === "number" && r.status >= 400 && !blocked.includes(r)));
  const redirected = results.filter((r) => r.finalUrl && !broken.includes(r));

  for (const r of broken) console.log(`BROKEN   ${r.status}  ${r.skill}  ${r.url}${r.note ? `  (${r.note})` : ""}`);
  for (const r of blocked) console.log(`BLOCKED  ${r.status}  ${r.skill}  ${r.url}`);
  for (const r of redirected) console.log(`REDIRECT      ${r.skill}  ${r.url} -> ${r.finalUrl}`);
  console.log(`\n${results.length} links: ${results.length - broken.length - blocked.length} ok, ${blocked.length} blocked, ${broken.length} broken.`);
  if (broken.length > 0) process.exit(1);
}

main();
