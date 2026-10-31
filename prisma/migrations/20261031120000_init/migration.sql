-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "hoursPerWeek" INTEGER NOT NULL DEFAULT 8,
    "targetDate" DATE,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "storagePath" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sha256" TEXT,
    "rawText" TEXT NOT NULL,
    "parsed" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "target_roles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "seniority" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "target_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_descriptions" (
    "id" UUID NOT NULL,
    "targetRoleId" UUID NOT NULL,
    "company" TEXT,
    "title" TEXT,
    "url" TEXT,
    "rawText" TEXT NOT NULL,
    "contentHash" TEXT,
    "parsed" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gap_analyses" (
    "id" UUID NOT NULL,
    "targetRoleId" UUID NOT NULL,
    "resumeId" UUID NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gap_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_plans" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "gapAnalysisId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "reason" TEXT,
    "startDate" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_weeks" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "goal" TEXT NOT NULL,
    "checkpoint" TEXT,

    CONSTRAINT "plan_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_tasks" (
    "id" UUID NOT NULL,
    "weekId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "skill" TEXT,
    "resourceUrl" TEXT,
    "estHours" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "plan_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_projects" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "skills" JSONB NOT NULL DEFAULT '[]',
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "talkingPoints" TEXT,
    "status" TEXT NOT NULL DEFAULT 'suggested',

    CONSTRAINT "portfolio_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "targetRoleId" UUID NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_questions" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "skill" TEXT,
    "question" TEXT NOT NULL,
    "rubric" JSONB NOT NULL,
    "answer" TEXT,
    "scores" JSONB,
    "feedback" TEXT,
    "modelAnswer" TEXT,

    CONSTRAINT "interview_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_logs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskId" UUID,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "selfRating" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_levels" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "level" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "skill_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "company" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "roleFamily" TEXT,
    "seniority" TEXT,
    "industry" TEXT,
    "companySize" TEXT,
    "source" TEXT,
    "matchScore" DOUBLE PRECISION,
    "tailored" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "appliedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMPTZ(6),
    "notes" TEXT,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "resumes_userId_createdAt_idx" ON "resumes"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "resumes_userId_sha256_key" ON "resumes"("userId", "sha256");

-- CreateIndex
CREATE INDEX "target_roles_userId_idx" ON "target_roles"("userId");

-- CreateIndex
CREATE INDEX "job_descriptions_targetRoleId_idx" ON "job_descriptions"("targetRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "job_descriptions_targetRoleId_contentHash_key" ON "job_descriptions"("targetRoleId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE INDEX "gap_analyses_targetRoleId_createdAt_idx" ON "gap_analyses"("targetRoleId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "gap_analyses_resumeId_idx" ON "gap_analyses"("resumeId");

-- CreateIndex
CREATE INDEX "learning_plans_userId_status_idx" ON "learning_plans"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "learning_plans_gapAnalysisId_version_key" ON "learning_plans"("gapAnalysisId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "plan_weeks_planId_weekNumber_key" ON "plan_weeks"("planId", "weekNumber");

-- CreateIndex
CREATE INDEX "plan_tasks_weekId_idx" ON "plan_tasks"("weekId");

-- CreateIndex
CREATE INDEX "portfolio_projects_planId_idx" ON "portfolio_projects"("planId");

-- CreateIndex
CREATE INDEX "interview_sessions_userId_createdAt_idx" ON "interview_sessions"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "interview_sessions_targetRoleId_idx" ON "interview_sessions"("targetRoleId");

-- CreateIndex
CREATE INDEX "interview_questions_sessionId_idx" ON "interview_questions"("sessionId");

-- CreateIndex
CREATE INDEX "progress_logs_userId_createdAt_idx" ON "progress_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "progress_logs_taskId_idx" ON "progress_logs"("taskId");

-- CreateIndex
CREATE INDEX "skill_levels_skillId_idx" ON "skill_levels"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_levels_userId_skillId_key" ON "skill_levels"("userId", "skillId");

-- CreateIndex
CREATE INDEX "applications_userId_status_idx" ON "applications"("userId", "status");

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_roles" ADD CONSTRAINT "target_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_targetRoleId_fkey" FOREIGN KEY ("targetRoleId") REFERENCES "target_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analyses" ADD CONSTRAINT "gap_analyses_targetRoleId_fkey" FOREIGN KEY ("targetRoleId") REFERENCES "target_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analyses" ADD CONSTRAINT "gap_analyses_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_plans" ADD CONSTRAINT "learning_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_plans" ADD CONSTRAINT "learning_plans_gapAnalysisId_fkey" FOREIGN KEY ("gapAnalysisId") REFERENCES "gap_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_weeks" ADD CONSTRAINT "plan_weeks_planId_fkey" FOREIGN KEY ("planId") REFERENCES "learning_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "plan_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_planId_fkey" FOREIGN KEY ("planId") REFERENCES "learning_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_targetRoleId_fkey" FOREIGN KEY ("targetRoleId") REFERENCES "target_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_logs" ADD CONSTRAINT "progress_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_logs" ADD CONSTRAINT "progress_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "plan_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_levels" ADD CONSTRAINT "skill_levels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_levels" ADD CONSTRAINT "skill_levels_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

