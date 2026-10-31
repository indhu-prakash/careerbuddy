// Generates docs/DATABASE.md (Mermaid ER/UML diagrams + table catalog) from prisma/schema.prisma,
// so the diagram can't drift from the schema. Run with: npm run docs:db
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

type Field = { name: string; type: string; list: boolean; optional: boolean; attrs: string; comment: string };
type Model = { name: string; table: string; fields: Field[]; uniques: string[][]; ids: string[][]; doc: string };

const schema = readFileSync("prisma/schema.prisma", "utf8");
const lines = schema.split(/\r?\n/);

const models: Model[] = [];
const enums = new Map<string, string[]>();
const docs: string[] = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/^\s*\/\//.test(line)) {
    docs.push(line.replace(/^\s*\/\/\s?/, ""));
    continue;
  }
  const m = line.match(/^model (\w+) \{/);
  const e = line.match(/^enum (\w+) \{/);
  if (e) {
    const values: string[] = [];
    while (!lines[++i].startsWith("}")) {
      const v = lines[i].trim().split(/\s+/)[0];
      if (v && !v.startsWith("//")) values.push(v);
    }
    enums.set(e[1], values);
    docs.length = 0;
  } else if (m) {
    const model: Model = { name: m[1], table: m[1], fields: [], uniques: [], ids: [], doc: docs.join(" ").trim() };
    docs.length = 0;
    while (!lines[++i].startsWith("}")) {
      const raw = lines[i].trim();
      if (!raw || raw.startsWith("//")) continue;
      const [body, ...rest] = raw.split("//");
      const comment = rest.join("//").trim();
      const map = body.match(/@@map\("([^"]+)"\)/);
      if (map) model.table = map[1];
      const uq = body.match(/@@unique\(\[([^\]]+)\]/);
      if (uq) model.uniques.push(uq[1].split(",").map((s) => s.trim().split("(")[0]));
      const id = body.match(/@@id\(\[([^\]]+)\]/);
      if (id) model.ids.push(id[1].split(",").map((s) => s.trim()));
      if (body.startsWith("@@")) continue;
      const f = body.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
      if (f) model.fields.push({ name: f[1], type: f[2], list: !!f[3], optional: !!f[4], attrs: f[5] ?? "", comment });
    }
    models.push(model);
  }
}

const modelNames = new Set(models.map((m) => m.name));
const byName = new Map(models.map((m) => [m.name, m]));

type Rel = { from: string; to: string; fk: string[]; optional: boolean; unique: boolean; label: string };
const rels: Rel[] = [];
for (const m of models) {
  for (const f of m.fields) {
    const rel = f.attrs.match(/@relation\((?:"[^"]*",\s*)?fields:\s*\[([^\]]+)\]/);
    if (!rel || !modelNames.has(f.type)) continue;
    const fk = rel[1].split(",").map((s) => s.trim());
    const unique =
      fk.length === 1 &&
      (m.fields.find((x) => x.name === fk[0])?.attrs.includes("@unique") || m.uniques.some((u) => u.length === 1 && u[0] === fk[0]));
    rels.push({ from: f.type, to: m.name, fk, optional: f.optional, unique: !!unique, label: f.name });
  }
}

const fkFields = (m: Model) => new Set(rels.filter((r) => r.to === m.name).flatMap((r) => r.fk));
const scalar = (m: Model) => m.fields.filter((f) => !modelNames.has(f.type));

function entity(m: Model): string {
  const fks = fkFields(m);
  const pk = new Set(m.ids.flat());
  const rows = scalar(m).map((f) => {
    const keys = [
      (f.attrs.includes("@id") || pk.has(f.name)) && "PK",
      fks.has(f.name) && "FK",
      f.attrs.includes("@unique") && "UK",
    ].filter(Boolean);
    const type = `${f.type}${f.list ? "[]" : ""}`;
    const note = [f.optional ? "nullable" : "", f.comment].filter(Boolean).join(", ").replace(/"/g, "'").replace(/\|/g, "/").slice(0, 70);
    return `    ${type} ${f.name}${keys.length ? ` ${keys.join(", ")}` : ""}${note ? ` "${note}"` : ""}`;
  });
  return `  ${m.name} {\n${rows.join("\n")}\n  }`;
}

function relation(r: Rel): string {
  const left = r.optional ? "|o" : "||";
  const right = r.unique ? "o|" : "o{";
  return `  ${r.from} ${left}--${right} ${r.to} : "${r.label}"`;
}

function diagram(names: string[], detailed: boolean): string {
  const set = new Set(names);
  const body = [
    ...(detailed ? names.map((n) => entity(byName.get(n)!)) : []),
    ...rels.filter((r) => set.has(r.from) && set.has(r.to)).map(relation),
  ];
  return "```mermaid\nerDiagram\n" + body.join("\n") + "\n```";
}

// Module grouping for the per-module diagrams.
const GROUPS: [string, string, string[]][] = [
  ["Users & intake (F1)", "Profile, resumes, the skills inventory and target roles.", ["User", "Resume", "UserSkill", "TargetRole", "RoleTrack", "Skill"]],
  ["Skill taxonomy (shared, seeded)", "Canonical skills with aliases, prerequisites, topics, curated resources and role templates.", ["Skill", "SkillTopic", "SkillEdge", "LearningResource", "RoleTrack", "RoleTrackSkill"]],
  ["Job descriptions & gap map (F2)", "JDs, extracted requirements and the saved gap matrix.", ["User", "Resume", "TargetRole", "JobDescription", "JobRequirement", "GapAnalysis", "GapAnalysisJob", "GapItem", "Skill"]],
  ["Learning plan & projects (F3, F4)", "Versioned plans, weeks, tasks and portfolio projects.", ["GapAnalysis", "LearningPlan", "PlanWeek", "PlanTask", "LearningResource", "PortfolioProject", "Skill"]],
  ["Mock interviews (F5)", "Sessions, questions (with follow-ups) and evaluations.", ["User", "TargetRole", "InterviewSession", "InterviewQuestion", "InterviewEvaluation", "Skill"]],
  ["Progress & applications (F6, F7)", "Append-only progress log, the application tracker and its event history.", ["User", "PlanTask", "ProgressEvent", "Application", "ApplicationEvent", "JobDescription", "Resume", "Skill"]],
  ["AI usage", "Every AI request: model, tokens, latency, outcome; successful results double as a cache.", ["User", "AiCall"]],
];

const out: string[] = [];
out.push(`# CareerBuddy: Database Design

> Generated from [prisma/schema.prisma](../prisma/schema.prisma) by \`npm run docs:db\`. Don't edit by hand.

Supabase Postgres, accessed only from the server through Prisma 7. **${models.length} tables**, **${enums.size} enums**.

- **Ownership:** every user-owned table carries \`userId\`, and every query is scoped to the signed-in user. Deleting a user cascades to all of their rows, and the \`users\` row itself cascades from Supabase's \`auth.users\`.
- **Row Level Security:** enabled on every table with no policies, so Supabase's public Data API can't read or write anything.
- **JSON columns** (\`Json\`) are JSONB, validated with Zod on write and read. They hold AI output that is always read as a whole (resume profile, week content, project specs, rubric scores).
- **Keys:** UUID primary keys. \`users.id\` equals the Supabase auth user id.

Notation (UML crow's foot): \`||\` exactly one, \`|o\` zero or one, \`o{\` zero or many. **PK** primary key, **FK** foreign key, **UK** unique.

## 1. Entity-relationship overview

All tables and relationships (attributes in §2).

${diagram(models.map((m) => m.name), false)}

## 2. Diagrams by module
`);
for (const [title, desc, names] of GROUPS) {
  out.push(`### ${title}\n\n${desc}\n\n${diagram(names, true)}\n`);
}

out.push(`## 3. Table catalog

| Model | Table | Purpose | Unique keys |
|---|---|---|---|
${models
  .map((m) => {
    const uniques = [
      ...m.fields.filter((f) => f.attrs.includes("@unique")).map((f) => f.name),
      ...m.uniques.map((u) => `(${u.join(", ")})`),
      ...m.ids.map((u) => `PK (${u.join(", ")})`),
    ];
    return `| ${m.name} | \`${m.table}\` | ${m.doc.replace(/\|/g, "/") || "—"} | ${uniques.join(", ") || "—"} |`;
  })
  .join("\n")}

## 4. Enums

| Enum | Values |
|---|---|
${[...enums].map(([name, values]) => `| ${name} | ${values.map((v) => `\`${v}\``).join(", ")} |`).join("\n")}

## 5. Migrations

Applied in order from [prisma/migrations](../prisma/migrations) with \`npm run db:deploy\`:

${readdirMigrations().map((m) => `- \`${m}\``).join("\n")}
`);

writeFileSync("docs/DATABASE.md", out.join("\n"));
console.log(`docs/DATABASE.md: ${models.length} tables, ${rels.length} relationships, ${enums.size} enums`);

function readdirMigrations(): string[] {
  return readdirSync("prisma/migrations").filter((d) => /^\d+_/.test(d)).sort();
}
