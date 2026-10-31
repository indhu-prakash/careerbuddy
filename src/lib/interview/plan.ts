// Pure interview logic, kept in code (not the LLM): which question types a session
// asks, which gap each question targets, question order, and when to follow up.
import type { QuestionType } from "@/lib/ai/prompts/interview-scoring";

export const INTERVIEW_KINDS = [
  "mixed",
  "technical",
  "coding",
  "system_design",
  "behavioral",
  "scenario",
  "role_specific",
] as const;
export type InterviewKind = (typeof INTERVIEW_KINDS)[number];

export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 8;
export const DEFAULT_QUESTIONS = 5;
// Each follow-up costs one more scoring request against the shared daily AI cap.
export const MAX_FOLLOW_UPS = 2;
// Gaps a session spreads its questions over, biggest first.
const MAX_FOCUS_SKILLS = 6;

// Question types per session kind, cycled to fill the requested count.
const KIND_TYPES: Record<InterviewKind, QuestionType[]> = {
  mixed: ["technical", "behavioral", "system_design", "scenario", "coding"],
  technical: ["technical"],
  coding: ["coding"],
  system_design: ["system_design"],
  behavioral: ["behavioral"],
  scenario: ["scenario"],
  role_specific: ["technical", "scenario", "system_design"],
};

export type FocusSkill = { skillId: string | null; skillName: string; status: "matched" | "partial" | "missing" };

export type PlannedSlot = {
  slot: number;
  type: QuestionType;
  skillId: string | null;
  skill: string | null;
  gap: "partial" | "missing" | null;
};

/**
 * The skills to interview on: unmatched gap items by priority (falling back to gap size),
 * or the most in-demand skills when nothing is missing.
 */
export function pickFocusSkills(
  items: { skillId: string | null; skillName: string; status: FocusSkill["status"]; gap: number; demand: number; priority: number | null }[],
): FocusSkill[] {
  const open = items.filter((i) => i.status !== "matched");
  const ranked = open.length
    ? [...open].sort((a, b) => (b.priority ?? b.gap) - (a.priority ?? a.gap) || b.gap - a.gap)
    : [...items].sort((a, b) => b.demand - a.demand);
  return ranked
    .slice(0, MAX_FOCUS_SKILLS)
    .map(({ skillId, skillName, status }) => ({ skillId, skillName, status }));
}

/** One slot per question: its type from the session kind, and a focus skill round-robin over the gaps. */
export function planSlots(kind: InterviewKind, count: number, skills: FocusSkill[]): PlannedSlot[] {
  const types = KIND_TYPES[kind];
  const n = Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, Math.round(count)));
  let next = 0;
  return Array.from({ length: n }, (_, i) => {
    const type = types[i % types.length];
    // Behavioral questions probe soft skills, not a catalog skill.
    const focus = type === "behavioral" || skills.length === 0 ? null : skills[next++ % skills.length];
    return {
      slot: i + 1,
      type,
      skillId: focus?.skillId ?? null,
      skill: focus?.skillName ?? null,
      gap: focus && focus.status !== "matched" ? focus.status : null,
    };
  });
}

/** Asking order: top-level questions by seq, each followed directly by its follow-ups. */
export function orderQuestions<Q extends { id: string; parentId: string | null; seq: number }>(questions: Q[]): Q[] {
  const bySeq = [...questions].sort((a, b) => a.seq - b.seq);
  const ids = new Set(bySeq.map((q) => q.id));
  const roots = bySeq.filter((q) => !q.parentId || !ids.has(q.parentId));
  return roots.flatMap((root) => [root, ...bySeq.filter((q) => q.parentId === root.id)]);
}

/** Follow up on a weak answer (any criterion ≤ 2), but never on a follow-up, and at most MAX_FOLLOW_UPS per session. */
export function shouldFollowUp(opts: {
  parentId: string | null;
  criteria: { score: number }[];
  followUpsSoFar: number;
}): boolean {
  if (opts.parentId) return false;
  if (opts.followUpsSoFar >= MAX_FOLLOW_UPS) return false;
  return opts.criteria.some((c) => c.score <= 2);
}

/** The model's follow-up wording, or a generic probe of the weakest criterion if it gave none. */
export function followUpText(suggested: string, criteria: { criterion: string; score: number }[]): string {
  const text = suggested.trim();
  if (text.length >= 10) return text;
  const weakest = [...criteria].sort((a, b) => a.score - b.score)[0];
  return weakest
    ? `Let's go deeper on ${weakest.criterion.toLowerCase()}: can you expand on that part of your answer with a concrete example?`
    : "Can you expand on your previous answer with a concrete example?";
}
