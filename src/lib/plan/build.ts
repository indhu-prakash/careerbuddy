// Pure helpers that turn a saved gap analysis and a scheduler result into plan rows.
// No DB access here, so the plan's wording and resource rules are unit-testable.
import type { GapContextItem } from "@/lib/analysis/load";
import { normalizeSkillTerm } from "@/lib/skills/normalize";
import type { ScheduleGap, ScheduledTask, Tier } from "@/lib/scoring/schedule";

/** Share of each week kept free for spillover (F3: ~15%). */
export const PLAN_SLACK = 0.15;
/** Share of the planned budget reserved for portfolio milestones (F4 "fit to time"). */
export const PROJECT_SHARE = 0.2;

const TIERS: Tier[] = ["fundamental", "intermediate", "advanced"];

/** Scheduler key: the catalog id, or the normalized name for skills outside the catalog. */
export function gapKey(item: { skillId: string | null; skillName: string }): string {
  return item.skillId ?? `name:${normalizeSkillTerm(item.skillName)}`;
}

/** Gap items with something left to close, as scheduler input. */
export function gapsFromContext(items: GapContextItem[]): ScheduleGap[] {
  return items
    .filter((i) => i.status !== "matched" && i.gap > 0)
    .map((i) => ({
      skillId: gapKey(i),
      name: i.skill?.name ?? i.skillName,
      demand: i.demand,
      gap: i.gap,
      have: i.have,
      category: i.category,
      priority: i.priority,
      currentLevel: i.currentLevel,
      requiredLevel: i.requiredLevel,
      effortHours: i.effortHours,
      skillCategory: i.skill?.category ?? null,
    }));
}

export type ResourceRow = { id: string; skillId: string; title: string; url: string; kind: string; tier: Tier };

/**
 * A curated resource for a skill at a tier: same tier first, then the nearest tier
 * (lower before higher). `part` rotates through same-tier options. Null if none exist;
 * links are never invented.
 */
export function pickResource(resources: ResourceRow[], tier: Tier, part = 0): ResourceRow | null {
  const t = TIERS.indexOf(tier);
  const byDistance = [...TIERS].sort(
    (a, b) => Math.abs(TIERS.indexOf(a) - t) - Math.abs(TIERS.indexOf(b) - t) || TIERS.indexOf(a) - TIERS.indexOf(b),
  );
  for (const candidate of byDistance) {
    const matches = resources.filter((r) => r.tier === candidate);
    if (matches.length) return matches[part % matches.length];
  }
  return null;
}

/** The slice of a tier's topics that task `part` of `parts` covers. */
export function topicSlice(topics: string[], part: number, parts: number): string[] {
  if (!topics.length) return [];
  const from = Math.floor((part * topics.length) / parts);
  const to = Math.floor(((part + 1) * topics.length) / parts);
  return to > from ? topics.slice(from, to) : [topics[part % topics.length]];
}

export function taskTitle(task: ScheduledTask, skillName: string, topics: string[]): string {
  const about = topicSlice(topics, task.part, task.parts).join(", ");
  const cont = task.continued ? " (continued)" : "";
  switch (task.kind) {
    case "learn":
      return `${skillName}: ${about || `${task.tier} concepts`}${cont}`;
    case "coding":
      return `Build with ${skillName}${about ? `: ${about}` : ""}${cont}`;
    case "exercise":
      return `Practice ${skillName}${about ? `: ${about}` : ""}${cont}`;
    case "assessment":
      return `Checkpoint: self-assess ${skillName}${cont}`;
  }
}

/** Week text when the AI call fails or is over budget, so a plan can still be saved. */
export function fallbackWeekText(skills: { name: string; topics: string[] }[]) {
  if (!skills.length) {
    return {
      goal: "Buffer week: catch up on anything unfinished and review earlier topics.",
      objectives: ["Finish open tasks from earlier weeks", "Review notes from the hardest topic so far"],
      exercises: [],
      checkpoint: "Can you explain each topic covered so far in two sentences?",
    };
  }
  const names = skills.map((s) => s.name).join(", ");
  return {
    goal: `Make solid progress on ${names}.`,
    objectives: skills.flatMap((s) => s.topics.slice(0, 2).map((t) => `${s.name}: ${t}`)).slice(0, 4),
    exercises: skills.map((s) => `Apply ${s.name} in a small hands-on example.`).slice(0, 3),
    checkpoint: `Explain and demonstrate the key ideas of ${names} without notes.`,
  };
}

/** UTC midnight today, matching the @db.Date columns. */
export function todayUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

const roundHalf = (x: number) => Math.round(x * 2) / 2;

/** Hours a project of a tier gets in the plan, split across its milestones (code decides, not the LLM). */
export const PROJECT_HOURS: Record<"beginner" | "intermediate" | "advanced" | "production", number> = {
  beginner: 4,
  intermediate: 6,
  advanced: 8,
  production: 10,
};

export function milestoneHours(tier: keyof typeof PROJECT_HOURS, count: number): number {
  return Math.max(1, roundHalf(PROJECT_HOURS[tier] / Math.max(1, count)));
}
