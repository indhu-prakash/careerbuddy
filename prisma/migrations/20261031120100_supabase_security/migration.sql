-- Supabase hardening. Safe on plain Postgres too (local dev, Prisma shadow DB).
--
-- 1) Row Level Security on every app table, with no policies.
--    Supabase exposes the public schema through its Data API to anyone holding the
--    public anon key; RLS without policies denies all of that access. The app reads
--    and writes only through Prisma on the server, connecting as the table owner,
--    which RLS does not restrict. Per-user isolation is enforced in the app layer
--    (every query is scoped by the session's user id).
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resumes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "target_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_descriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gap_analyses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "learning_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan_weeks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portfolio_projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interview_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interview_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "progress_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- 2) Tie app users to Supabase Auth users, so deleting an auth user deletes all of
--    their data (every user-owned table cascades from "users").
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_id_auth_fkey"
      FOREIGN KEY ("id") REFERENCES auth.users ("id") ON DELETE CASCADE;
  END IF;
END
$$;
