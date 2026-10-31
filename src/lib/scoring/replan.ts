// Replan triggers (F6). Pure: plan progress and skill state in, triggers out. A trigger
// only proposes a new plan version; the user still has to accept it.

export type WeekProgress = {
  weekNumber: number;
  plannedHours: number;
  actualHours: number;
  ended: boolean; // the week is in the past
  checkpointsPassed: boolean | null; // null = the week had no scored checkpoint
};

export type SkillState = {
  skillId: string;
  name: string;
  level: number; // current inventory level 0..4
  requiredLevel: number;
  hasRemainingTasks: boolean;
  latestScore: number | null; // most recent interview/assessment score, 0..1
};

export type TriggerKind = "behind" | "ahead" | "mastered" | "weak";

export type Trigger = { kind: TriggerKind; reason: string; skillIds: string[] };

export const BEHIND_RATIO = 0.7;
export const AHEAD_RATIO = 1.2;
export const WEAK_SCORE = 0.5;
const STREAK_WEEKS = 2;

export function evaluateTriggers(input: { weeks: WeekProgress[]; skills: SkillState[] }): Trigger[] {
  const triggers: Trigger[] = [];
  const ended = input.weeks
    .filter((w) => w.ended && w.plannedHours > 0)
    .sort((a, b) => a.weekNumber - b.weekNumber);
  const recent = ended.slice(-STREAK_WEEKS);

  if (recent.length === STREAK_WEEKS) {
    const pct = (w: WeekProgress) => Math.round((w.actualHours / w.plannedHours) * 100);
    if (recent.every((w) => w.actualHours < w.plannedHours * BEHIND_RATIO)) {
      triggers.push({
        kind: "behind",
        reason: `You did ${recent.map(pct).join("% and ")}% of the planned hours in weeks ${recent
          .map((w) => w.weekNumber)
          .join(" and ")}, so the remaining work is spread over your actual pace.`,
        skillIds: [],
      });
    } else if (
      recent.every((w) => w.actualHours > w.plannedHours * AHEAD_RATIO) &&
      recent.every((w) => w.checkpointsPassed !== false)
    ) {
      triggers.push({
        kind: "ahead",
        reason: `You did ${recent.map(pct).join("% and ")}% of the planned hours in weeks ${recent
          .map((w) => w.weekNumber)
          .join(" and ")} and passed the checkpoints, so later work can move earlier.`,
        skillIds: [],
      });
    }
  }

  const mastered = input.skills.filter((s) => s.hasRemainingTasks && s.level >= s.requiredLevel);
  if (mastered.length) {
    triggers.push({
      kind: "mastered",
      reason: `${names(mastered)} ${mastered.length === 1 ? "has" : "have"} reached the required level, so the remaining tasks for ${
        mastered.length === 1 ? "it" : "them"
      } can be dropped.`,
      skillIds: mastered.map((s) => s.skillId),
    });
  }

  const weak = input.skills.filter((s) => s.latestScore !== null && s.latestScore < WEAK_SCORE);
  if (weak.length) {
    triggers.push({
      kind: "weak",
      reason: `Your latest score in ${names(weak)} was under ${WEAK_SCORE * 100}%, so reinforcement work is added.`,
      skillIds: weak.map((s) => s.skillId),
    });
  }

  return triggers;
}

export type PlannedTask = { title: string; skill: string | null; weekNumber: number };

/**
 * Task-level diff between the remaining work of the current plan and a proposed one.
 * Week numbers must be on the same calendar (absolute weeks of the original plan).
 * Tasks match by skill + title; a match in a different week counts as moved.
 */
export function diffTasks(before: PlannedTask[], after: PlannedTask[]) {
  const key = (t: PlannedTask) => `${t.skill ?? ""}|${t.title.trim().toLowerCase()}`;
  const pool = new Map<string, PlannedTask[]>();
  for (const t of before) pool.set(key(t), [...(pool.get(key(t)) ?? []), t]);

  const added: PlannedTask[] = [];
  const moved: { title: string; from: number; to: number }[] = [];
  for (const t of after) {
    const matches = pool.get(key(t));
    const match = matches?.shift();
    if (!match) added.push(t);
    else if (match.weekNumber !== t.weekNumber) moved.push({ title: t.title, from: match.weekNumber, to: t.weekNumber });
  }
  const removed = [...pool.values()].flat();
  return { added, removed, moved };
}

function names(skills: SkillState[]): string {
  const n = skills.map((s) => s.name);
  return n.length <= 2 ? n.join(" and ") : `${n.slice(0, -1).join(", ")} and ${n.at(-1)}`;
}
