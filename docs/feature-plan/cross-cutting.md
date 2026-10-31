# Cross-Cutting Items

Issues and decisions that affect every module. **Back to:** [README](README.md)

## 1. Persistence (main blocker)

Nothing is written to the database. Only [auth.ts](../../src/lib/auth.ts) and `/api/health` use Prisma, and [storage.ts](../../src/lib/storage.ts) is never called. Every link between modules (gap → plan → progress → replan) depends on saved rows, so this comes first.

- Every route filters by `userId` from `requireUser()`; Supabase RLS is the backstop.
- Save the model name and `promptVersion` on AI-derived rows (`GapAnalysis`, `InterviewEvaluation`) so results can be traced.

## 2. AI layer: logging, limits, caching

**Being built now:** `src/lib/ai/service.ts` adds `runAiTask`, which:

- serves identical requests (same task, prompt version and input) from cache,
- enforces a per-user daily limit (`AI_DAILY_REQUEST_LIMIT`, default 20) and returns HTTP 429 when it's exceeded,
- logs every call to `ai_calls` (model, tokens, outcome).

**Still to do:** route the analyze and score endpoints, and every new AI feature, through `runAiTask` instead of calling `generateStructured` directly. This matters on the free tier's 50 requests/day for the whole account.

## 3. Long AI calls

The free Nemotron model takes about 50 s per call and the calls run synchronously.

- Short term: keep `maxDuration` (120–300 s) and show progress in the UI.
- Multi-step generation (plan + projects + questions): run each step as its own request, save its status, and poll from the UI. Inngest or Trigger.dev (both JS) only if that isn't enough.
- For demos: a faster paid model. This has nothing to do with the stack choice.

## 4. Privacy

- Audio is never stored.
- Resumes go in the private `resumes` bucket, accessed only through signed URLs.
- **Free OpenRouter models may log or train on prompts. Don't use real users' resumes until a paid model that doesn't log is configured** (ARCHITECTURE.md §4.4).
- Provide a delete-my-data endpoint (cascades are already in the schema).

## 5. Reports (Excel/PDF)

Today: `npm run analyze` → `scripts/report/build_report.py` (openpyxl + reportlab), CLI only.

| Option | How | Trade-off |
|---|---|---|
| **A (recommended)** | Port to `exceljs` + `@react-pdf/renderer` as a download route | One runtime, works in the app |
| B | Keep the Python script and run it as a separate Python function or service | Keeps the existing code but adds a second runtime and deployment |

Choose B only if the JS output is clearly worse.

## 6. When to add Python

Add a Python service only when at least one of these is true:

| Trigger | Example | Shape |
|---|---|---|
| A Python-only library is clearly better and isn't available as an API | reportlab quality, heavy pandas analytics | One stateless endpoint |
| Running ML models yourself | Local embeddings, self-hosted Whisper | Service on Modal / Railway / Fly |
| Training on accumulated data | F7 stage 3 cross-user model | Scheduled batch job writing to Postgres |
| Jobs longer than serverless limits | Bulk JD processing | Queue worker (try JS queues first) |
| A team member owns a Python component | A data scientist's model | Separate service with a clear contract |

If Python is added:

1. Next.js stays the only public API and the only place auth runs.
2. Python is called server-to-server with a shared secret.
3. Contracts are defined once (Zod → JSON Schema → Pydantic).
4. Python uses the same Postgres; it doesn't get its own database.

## 7. Seed data and tests

- `vitest run` on 2026-10-31: **17 / 17 pass**. The reported failing test didn't reproduce.
- A real data gap: `qa-automation-engineer`, `data-analyst` and `data-scientist` have **0 core skills at the advanced tier** in [roles.json](../../prisma/seed/data/roles.json). **Decide:** if every role should have core advanced skills, fix the data and add an assertion to [seed-data.test.ts](../../tests/seed-data.test.ts). If not, document the exception.
- Add unit tests for every new `src/lib/scoring/*` module (schedule, coverage, progress, applications).

## 8. Missing pages

`/onboarding` ([F1](F1-intake.md)) and a real `/dashboard` (progress, next tasks, readiness; [F6](F6-progress-replan.md)) are listed in PLAN.md but not built.

## 9. Mobile

Responsive PWA. The mic needs HTTPS, so test phones through a Vercel preview or a tunnel.
