# CareerBuddy: Project Plan

## 1. Problem & Goal

Students and working professionals moving into a new role usually don't know:
- how well their current resume matches the roles they want,
- **which skills are missing** in the job descriptions (JDs) actually being posted,
- what to learn first, in what order, and how to prove it (portfolio),
- whether they are interview-ready,
- which kinds of roles are actually responding to their applications.

**CareerBuddy** takes a resume plus one or more real JDs, extracts keywords and skills from both,
shows the match and the gaps, and then coaches the user end to end: a learning plan, portfolio projects,
mock interviews, progress tracking, and application analytics.

## 2. Required Features (from the brief)

| # | Feature | What "done" looks like |
|---|---------|------------------------|
| F1 | **Resume & target-role intake** | User uploads a resume (PDF/DOCX/text) and states a target role, plus hours per week and a timeline. Resume is parsed into structured data: skills, experience, education, projects. |
| F2 | **Skill-gap map from real JDs** | User pastes or uploads 1–N real JDs. Skills are extracted and normalized (e.g. "k8s" = "Kubernetes"), weighted by how often they appear across JDs and whether they are *required* or *nice to have*, then compared with the resume. Output: a match score plus skills grouped as **Matched / Partial / Missing**, with evidence quotes. |
| F3 | **Week-by-week learning plan** | Built from the gaps, ordered by (importance × JD frequency) ÷ effort and limited by available hours/week. Each week has goals, resources, tasks, and a checkpoint. |
| F4 | **Portfolio project suggestions** | 2–4 projects, each closing several gaps at once. Each has a scope, the skills it demonstrates, milestones, and a "how to talk about it in an interview" note. |
| F5 | **Mock interviews scored with a rubric** | Questions generated from the target role and gaps (technical + behavioral). User answers in text (voice is a stretch goal). Each answer is scored against an explicit rubric (e.g. correctness, depth, communication, STAR structure) with feedback and a model answer. |
| F6 | **Progress tracking that adjusts the plan** | User checks off tasks and logs hours. Self-ratings and mock-interview scores update skill levels. The plan is **re-generated** when the user falls behind or gets ahead, or when a skill is mastered or still weak. |
| F7 | **Application tracker that learns** | User logs applications (company, role, seniority, industry, source, match score at the time, status). The system tracks response rates by role "kind" and highlights which role types / sources / match-score bands get responses, then feeds that into targeting advice. |

## 3. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| App framework | **Next.js 15 (App Router) + TypeScript** | One repo for UI and API routes; fast to demo |
| UI | Tailwind CSS (+ shadcn/ui later) | Quick, clean UI |
| DB / ORM | **Supabase Postgres + Prisma 7** (`@prisma/adapter-pg`) | Managed Postgres that runs with serverless hosting; JSONB for AI output; pgvector available later |
| Auth / Storage | **Supabase Auth** (magic link) + **Supabase Storage** (private `resumes` bucket, signed URLs) | One vendor for DB, auth and files |
| Hosting | **Vercel** | Native Next.js; functions up to 300 s for LLM calls |
| LLM | **OpenRouter free models** via `fetch` (no SDK): primary `nvidia/nemotron-3.5-super-vl:free`, fallback `google/gemma-4-31b-it:free` (set by `AI_MODEL_PRIMARY` / `AI_MODEL_FALLBACK`) | Resume/JD extraction, plan generation, interview scoring at $0. Free tier is capped at 50 requests/day and is for dev/demo only (no real users' resumes) |
| Structured output | Zod → `z.toJSONSchema` → `response_format` (strict JSON schema on the primary model, JSON mode on the fallback), then a Zod parse | Typed, validated JSON from every LLM call |
| File parsing | `pdf-parse` (PDF), `mammoth` (DOCX) | Resume upload |
| Reports | `scripts/analyze.ts` → `scripts/report/build_report.py` (openpyxl + reportlab) | Shareable Excel/PDF gap report |
| Charts | Recharts (to install when the gap-map UI is built) | Gap map, progress, response-rate charts |
| Validation | Zod | Shared between API and LLM schemas |

## 4. Architecture

```
┌─────────────────────── Next.js app ───────────────────────┐
│  UI pages (app/)                                           │
│   /onboarding  /gap-map  /plan  /projects  /interview      │
│   /progress    /applications   /dashboard                  │
│                         │                                  │
│  API routes (app/api/v1/*) ─┴─► services (src/lib/...)     │
│                                │            │              │
│                     LLM layer (src/lib/ai)  Prisma (DB)    │
│                     - prompts + Zod schemas   Supabase PG  │
│                     - OpenRouter client                    │
└────────────────────────────────────────────────────────────┘
```

**Core pipeline:**
```
Resume ─► parse ─► ResumeProfile(skills[])  ┐
                                            ├─► normalize ─► GapAnalysis ─► LearningPlan ─► Weeks/Tasks
JDs[]  ─► parse ─► JDSkills[] (req/nice)    ┘                    │                ▲
                                                                 ├─► PortfolioProjects
                                                                 └─► InterviewQuestions ─► Scores ─┐
Progress logs + interview scores ─────────────────────────────────► SkillLevel updates ─► replan ──┘
Applications + outcomes ─► response-rate model ─► targeting insights
```

### Gap-scoring logic (deterministic, after LLM extraction)
For each normalized skill `s` across N JDs:
- `demand(s)` = (number of JDs mentioning `s`) / N, × 1.0 if required or × 0.5 if nice to have
- `have(s)` = 0 (missing), 0.5 (partial / adjacent evidence), or 1 (clear evidence in resume)
- `gap(s)` = demand(s) × (1 − have(s))
- **Match score** = Σ demand·have / Σ demand

The LLM handles extraction and normalization. The scoring itself is plain code, so it is explainable and testable.

### Application "learning" (F7)
- Features per application: role family, seniority, industry, company size, source (referral / job board / direct), match-score band, and whether the resume was tailored.
- Track response rate per feature value with Beta smoothing (`(responses+1)/(apps+2)`) so small samples don't mislead.
- Show the top/bottom segments and suggest targeting changes (e.g. "referrals: 40% vs job boards: 6%").
- Stretch: a logistic regression once there are 30+ applications.

## 5. Data Model

Source of truth: `prisma/schema.prisma` (27 tables on Supabase Postgres, RLS on all). Every user-owned table has `userId`.

| Module | Tables |
|---|---|
| Users | `users` (profile, goals, hours/week; id = Supabase auth user) |
| Skill taxonomy (shared, seeded) | `skills`, `skill_topics`, `skill_edges` (prereq/related), `learning_resources`, `role_tracks`, `role_track_skills` |
| 1. Intake | `resumes` (deduped by text hash), `user_skills` (inventory: level 0–4, evidence type demonstrated / mentioned / self_reported / assessed, quotes, user-confirmed flag), `target_roles` (linked to a role track when the title matches) |
| 2. JDs & gaps | `job_descriptions` (deduped per user), `job_requirements` (per-JD skill, must/nice, linked to canonical skill), `gap_analyses`, `gap_items` (the matrix), `gap_analysis_jobs` |
| 3/6. Roadmap & replanning | `learning_plans` (versioned via `parentId`), `plan_weeks`, `plan_tasks` (kind, status, hours, score, curated resource) |
| 4. Projects | `portfolio_projects` (tier, spec JSON, status, repo URL) |
| 5. Interviews | `interview_sessions`, `interview_questions` (follow-ups via `parentId`), `interview_evaluations` |
| 6. Progress | `progress_events` (append-only: tasks, hours, assessments, interview scores, level changes, plan revisions) |
| 7. Applications | `applications`, `application_events` (stage history, rejection reasons, feedback) |
| AI | `ai_calls` (every AI request: task, model, tokens, cost, latency, outcome; successful results reused as a cache) |

## 6. Folder Structure

```
carrer_pivot/
├─ PLAN.md                  ← this file
├─ README.md
├─ .env.example             ← DATABASE_URL, DIRECT_URL, Supabase keys, AI keys
├─ prisma/
│  └─ schema.prisma
├─ src/
│  ├─ app/                  ← Next.js pages + api routes
│  │  ├─ api/health/        ← DB + config check
│  │  ├─ api/v1/            ← versioned API (feature routes added per phase)
│  │  ├─ auth/, login/      ← Supabase magic-link sign-in
│  │  └─ (pages)...
│  ├─ lib/
│  │  ├─ ai/                ← OpenRouter client, versioned prompts + Zod schemas
│  │  ├─ scoring/           ← gap scoring, response-rate model (pure functions + tests)
│  │  ├─ supabase/          ← server / admin clients
│  │  ├─ auth.ts, storage.ts
│  │  └─ db.ts              ← Prisma client
│  └─ middleware.ts         ← session refresh
├─ scripts/                 ← analyze.ts (gap analysis CLI), report/ (Excel/PDF), setup-storage.ts
└─ tests/
```

## 7. Milestones

| Phase | Scope | Exit criteria |
|-------|-------|---------------|
| **P0: Setup** ✅ (this step) | Next.js + TS + Tailwind, Prisma/Supabase Postgres, Supabase Auth + Storage, OpenRouter client, env, folder skeleton, PLAN.md | `npm run dev` serves the home page; `prisma migrate` runs |
| **P1: Intake + Gap map** (F1, F2) | Resume upload/parse, JD paste, extraction, normalization, gap scoring, gap-map UI | Resume + 3 JDs → match score and Matched/Partial/Missing lists with evidence |
| **P2: Plan + Projects** (F3, F4) | Plan generator, week view, portfolio suggestions | Plan fits within hours/week; every top-5 gap is covered by a task or project |
| **P3: Mock interviews** (F5) | Question gen, answer capture, rubric scoring, feedback | Session gives per-criterion scores + model answer |
| **P4: Progress + Replan** (F6) | Task check-off, hours log, skill levels, re-plan trigger | Falling behind or mastering a skill produces a new plan version with a diff |
| **P5: Application tracker** (F7) | CRUD, status pipeline, response-rate insights | Dashboard shows response rate by segment + recommendations |
| **P6: Polish** | Dashboard, seed demo data, README, demo script | End-to-end demo in < 5 minutes |

## 8. LLM Usage Principles
- Every LLM call returns **Zod-validated JSON** (structured outputs). No free-text parsing.
- The LLM **extracts and generates**; **code scores**. Gap math and response rates stay deterministic.
- Prompts live in `src/lib/ai/prompts/` and are versioned.
- Check `finish_reason` (`length` = truncated) and validate before using any output; fall back to the second model on failure.
- The OpenRouter key stays on the server (`OPENROUTER_API_KEY`) and is only used in API routes and scripts.
- Free models are for development and demos. Before real users, switch to a paid, no-training provider (ARCHITECTURE.md §4.4).

## 9. Risks / Open Questions
- **Skill normalization quality**: start with an LLM-based canonical mapping and cache it in the `Skill` table.
- **Resume parsing of complex PDFs**: fall back to pasted text.
- **Small sample sizes in F7**: use smoothing and show confidence ("based on 4 applications").
- **Auth**: Supabase Auth (magic link); user identity comes only from the verified session.
