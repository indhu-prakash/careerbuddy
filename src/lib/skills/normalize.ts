// Canonical form for matching skill names and aliases (seed data, LLM output, user edits).
// Punctuation is kept on purpose: "C#", "C++" and "C" are different skills, and
// ".NET" must not collapse to "net". Spelling variants ("node.js" / "nodejs") are
// listed as explicit aliases instead.
export function normalizeSkillTerm(term: string): string {
  return term
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
