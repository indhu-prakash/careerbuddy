// Gap-map scoring (F2). Pure and deterministic: the LLM only extracts requirements and
// resume evidence; every number, status, category and rank below is computed here.
//
// Skills are keyed by catalog skill id when known, otherwise by normalized name, so
// "k8s" in a JD and "Kubernetes" on the resume land on the same row.
//
//   demand   = JD demand (1 required / 0.5 nice, averaged over JDs); with fewer than 3 JDs
//              the role template (1 core / 0.5 recommended, scaled by templateWeight) can
//              raise it, but never above what the JDs themselves ask for
//   have     = 1 if current level >= required level, 0.5 if some level, else 0
//   gap      = demand × (1 − have)
//   match    = Σ demand·have / Σ demand
//   priority = importance(category) × demand ÷ effort (in 10-hour units)

export type RequirementCategory = "must_have" | "good_to_have" | "advanced" | "domain";
export type GapStatus = "matched" | "partial" | "missing";

export type Requirement = {
  key: string;
  skillId: string | null;
  name: string;
  required: boolean;
  requiredLevel: number | null; // 1..4 hint from the JD wording
  domain: boolean; // industry/domain knowledge rather than a technical skill
  quote: string | null;
};

export type TemplateSkill = {
  key: string;
  skillId: string;
  name: string;
  requiredLevel: number; // 1..4
  importance: "core" | "recommended";
  choiceGroup: string | null; // alternatives: knowing one satisfies the group
};

export type HeldSkill = { key: string; level: number; quote: string | null };

export type GapMapInput = {
  jds: Requirement[][];
  template?: TemplateSkill[];
  held: HeldSkill[];
  /** For each skill key, keys of related skills (knowledge transfers between them). */
  related?: Map<string, string[]>;
  /** Display names for related-skill keys, for "transfers from" notes. */
  names?: Map<string, string>;
};

export type GapMapItem = {
  key: string;
  skillId: string | null;
  skillName: string;
  demand: number;
  have: number;
  gap: number;
  status: GapStatus;
  currentLevel: number;
  requiredLevel: number;
  category: RequirementCategory;
  effortHours: number;
  priority: number;
  fromTemplate: boolean; // in the role template but in none of the JDs
  jdCount: number; // JDs that mention it
  jdQuotes: string[];
  evidence: string | null; // resume quote
  transferableFrom: string[];
};

export const HOURS_PER_LEVEL = 10;
const TRANSFER_DISCOUNT = 0.7;
const DEFAULT_REQUIRED_LEVEL = 2;
const IMPORTANCE: Record<RequirementCategory, number> = {
  must_have: 1,
  advanced: 0.8,
  domain: 0.7,
  good_to_have: 0.6,
};

/** Share of demand that comes from the role template: 2/3 with 1 JD, 1/3 with 2, none with 3+. */
export function templateWeight(jdCount: number, hasTemplate: boolean): number {
  if (!hasTemplate) return 0;
  return Math.max(0, (3 - jdCount) / 3);
}

export function scoreGapMap(input: GapMapInput): {
  matchScore: number;
  items: GapMapItem[];
  templateWeight: number;
} {
  const n = input.jds.length;
  const w = templateWeight(n, (input.template?.length ?? 0) > 0);
  const held = new Map(input.held.map((h) => [h.key, h]));

  type Agg = {
    skillId: string | null;
    name: string;
    weightSum: number;
    requiredCount: number;
    levels: number[];
    domain: boolean;
    jdCount: number;
    quotes: string[];
    template?: TemplateSkill;
  };
  const agg = new Map<string, Agg>();
  const get = (key: string, skillId: string | null, name: string) => {
    let a = agg.get(key);
    if (!a) {
      a = { skillId, name, weightSum: 0, requiredCount: 0, levels: [], domain: false, jdCount: 0, quotes: [] };
      agg.set(key, a);
    }
    a.skillId ??= skillId;
    return a;
  };

  for (const jd of input.jds) {
    // Count each skill once per JD, keeping the strongest mention.
    const perJd = new Map<string, Requirement>();
    for (const r of jd) {
      const prev = perJd.get(r.key);
      if (!prev || (r.required && !prev.required)) perJd.set(r.key, { ...r, quote: r.quote ?? prev?.quote ?? null });
    }
    for (const r of perJd.values()) {
      const a = get(r.key, r.skillId, r.name);
      a.weightSum += r.required ? 1 : 0.5;
      if (r.required) a.requiredCount += 1;
      if (r.requiredLevel) a.levels.push(r.requiredLevel);
      a.domain ||= r.domain;
      a.jdCount += 1;
      if (r.quote && !a.quotes.includes(r.quote)) a.quotes.push(r.quote);
    }
  }

  if (w > 0) {
    for (const t of pickTemplateSkills(input.template!, held, agg)) {
      get(t.key, t.skillId, t.name).template = t;
    }
  }

  const items: GapMapItem[] = [];
  let num = 0;
  let den = 0;
  for (const [key, a] of agg) {
    const jdDemand = n > 0 ? a.weightSum / n : 0;
    const tDemand = a.template ? (a.template.importance === "core" ? 1 : 0.5) : 0;
    // Real JD evidence is never diluted by the template; the template only fills in.
    const demand = round(Math.max(jdDemand, w * tDemand));
    if (demand <= 0) continue;

    const requiredLevel = a.levels.length
      ? median(a.levels)
      : (a.template?.requiredLevel ?? DEFAULT_REQUIRED_LEVEL);
    const h = held.get(key);
    const currentLevel = h?.level ?? 0;
    const have = currentLevel >= requiredLevel ? 1 : currentLevel > 0 ? 0.5 : 0;
    const gap = round(demand * (1 - have));
    const fromTemplate = a.jdCount === 0;

    const category: RequirementCategory = a.domain
      ? "domain"
      : fromTemplate
        ? a.template!.importance === "core"
          ? "must_have"
          : "good_to_have"
        : a.requiredCount / n >= 0.5
          ? "must_have"
          : requiredLevel >= 3
            ? "advanced"
            : "good_to_have";

    const transferableFrom = (input.related?.get(key) ?? [])
      .filter((k) => (held.get(k)?.level ?? 0) >= 2)
      .map((k) => input.names?.get(k) ?? k);
    const levelsToClose = Math.max(0, requiredLevel - currentLevel);
    const effortHours =
      Math.round(levelsToClose * HOURS_PER_LEVEL * (transferableFrom.length ? TRANSFER_DISCOUNT : 1) * 2) / 2;
    const priority =
      gap > 0 ? round((IMPORTANCE[category] * demand) / Math.max(1, effortHours / HOURS_PER_LEVEL)) : 0;

    num += demand * have;
    den += demand;
    items.push({
      key,
      skillId: a.skillId,
      skillName: a.name,
      demand,
      have,
      gap,
      status: have === 1 ? "matched" : have === 0.5 ? "partial" : "missing",
      currentLevel,
      requiredLevel,
      category,
      effortHours,
      priority,
      fromTemplate,
      jdCount: a.jdCount,
      jdQuotes: a.quotes,
      evidence: h?.quote ?? null,
      transferableFrom,
    });
  }

  items.sort((a, b) => b.gap - a.gap || b.priority - a.priority || b.demand - a.demand);
  return { matchScore: den ? round(num / den) : 0, items, templateWeight: round(w) };
}

/**
 * Template skills to blend in. A choice group (e.g. React | Vue | Angular) counts once:
 * the member the user knows best, else one a JD asks for, else the first listed.
 */
function pickTemplateSkills(
  template: TemplateSkill[],
  held: Map<string, HeldSkill>,
  inJds: Map<string, unknown>,
): TemplateSkill[] {
  const out: TemplateSkill[] = [];
  const groups = new Map<string, TemplateSkill[]>();
  for (const t of template) {
    if (!t.choiceGroup) out.push(t);
    else groups.set(t.choiceGroup, [...(groups.get(t.choiceGroup) ?? []), t]);
  }
  for (const members of groups.values()) {
    const best = [...members].sort(
      (a, b) =>
        (held.get(b.key)?.level ?? 0) - (held.get(a.key)?.level ?? 0) ||
        Number(inJds.has(b.key)) - Number(inJds.has(a.key)),
    )[0];
    out.push(best);
  }
  return out;
}

const LEVEL_NAMES = ["none", "beginner", "intermediate", "advanced", "expert"];

/** Plain next steps from the top gaps. Deterministic, so no extra AI request. */
export function gapRecommendations(
  items: GapMapItem[],
  ctx: { jdCount: number; roleTitle?: string | null },
  max = 5,
): string[] {
  return items
    .filter((i) => i.gap > 0)
    .sort((a, b) => b.priority - a.priority || b.gap - a.gap)
    .slice(0, max)
    .map((i) => {
      const target = `${i.skillName} to ${LEVEL_NAMES[i.requiredLevel]} (you're at ${LEVEL_NAMES[i.currentLevel]})`;
      const why = i.fromTemplate
        ? `a ${i.category === "must_have" ? "core" : "recommended"} skill for ${ctx.roleTitle ?? "this role"}`
        : `asked for in ${i.jdCount} of ${ctx.jdCount} job description${ctx.jdCount === 1 ? "" : "s"}`;
      const transfer = i.transferableFrom.length ? ` Your ${i.transferableFrom.join(", ")} experience transfers.` : "";
      return `Build ${target}: about ${i.effortHours} h, ${why}.${transfer}`;
    });
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}
