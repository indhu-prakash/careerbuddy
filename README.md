# CareerBuddy

A Next.js 15 full-stack app (UI and API routes in one deployment), using Supabase for Postgres, Auth and Storage, and hosted on Vercel. CareerBuddy is an AI-powered career guidance platform that helps you upskill, identify skill gaps, and navigate toward your desired role. See [PLAN.md](PLAN.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier) and save the database password.
2. Copy `.env.example` to `.env` and fill it in:
   - **Project Settings → Database → Connection string:**
     - _Transaction pooler_ (port 6543) → `DATABASE_URL`
     - _Session pooler_ or _Direct_ (port 5432) → `DIRECT_URL`
   - **Project Settings → API Keys:**
     - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
     - Publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
     - Secret key → `SUPABASE_SECRET_KEY` (server-only, never expose)
   - **AI ([openrouter.ai/keys](https://openrouter.ai/keys)):**
     - `OPENROUTER_API_KEY` (server-only).
     - `AI_MODEL_PRIMARY` / `AI_MODEL_FALLBACK` default to `nvidia/nemotron-3.5-super-vl:free` and `google/gemma-4-31b-it:free`.
     - Free models allow 50 requests a day (1,000 after buying 10 credits). Use them for dev and demos only, not real users' resumes.
3. **Authentication → URL Configuration:**
   - Site URL: `http://localhost:3000` (change it to the Vercel URL in production).
   - Redirect URLs: add `http://localhost:3000/auth/callback` and `https://<your-vercel-domain>/auth/callback`.
   - Email sign-in (magic link) is on by default.

## 2. Set up the database and storage

```bash
npm install
npm run db:deploy        # applies prisma/migrations to Supabase (uses DIRECT_URL)
npm run supabase:setup   # creates the private "resumes" bucket (5 MB, PDF/DOCX)
npm run dev
```

Check that everything is connected:

- `http://localhost:3000/api/health` should return `"db": "connected"`.
- Sign in at `/login`, then open `/api/v1/me`.

When you change `prisma/schema.prisma`, run `npm run db:migrate -- --name <change>` (Prisma migrate dev against `DIRECT_URL`) and commit the new migration.

## 3. Deploy to Vercel

1. Push the repo to GitHub, then go to **Vercel → Add New Project** and import it. Vercel detects Next.js automatically.
2. **Settings → Environment Variables:** add every variable from `.env` for Production (and Preview). Set `NEXT_PUBLIC_SITE_URL` to the production URL.
3. Deploy. `npm run build` runs `prisma generate && next build`.
4. Apply migrations to production with `npm run db:deploy` (locally against the production `DIRECT_URL`, or from CI on merge to `main`).
5. Add the production `/auth/callback` URL to Supabase's redirect URLs (step 1.3).

Free-tier notes:

- Supabase Free pauses a project after 7 days of inactivity. Open it the day before a demo.
- Vercel Hobby is for non-commercial use, and functions can run for up to 300 s.

## Security model

- **Identity:** the user's identity comes only from the verified Supabase session (`requireUser()` in `src/lib/auth.ts`). Every query is scoped by that user id.
- **Database:** RLS is enabled on every table with no policies, so Supabase's public Data API exposes nothing. The app accesses data only through Prisma on the server.
- **Resumes:** stored in a private bucket under `{userId}/…`. Upload and download use short-lived signed URLs issued after an ownership check (`src/lib/storage.ts`).
- **Account deletion:** deleting a Supabase auth user cascades to all of their app data.

## Scripts

| Script                   | What it does                        |
| ------------------------ | ----------------------------------- |
| `npm run dev`            | Local dev server                    |
| `npm test`               | Vitest unit tests                   |
| `npm run db:deploy`      | Apply migrations                    |
| `npm run db:migrate`     | Create a new migration (dev)        |
| `npm run db:studio`      | Prisma Studio                       |
| `npm run supabase:setup` | Create or update the storage bucket |
