-- Module tables for intake, gap mapping, roadmap, projects, interviews, progress,
-- applications and AI usage. Generated with prisma migrate diff.
-- Drops/retypes columns of the first-draft tables, which held no rows when this was
-- written (2026-10-31); do not reuse this pattern on tables with data.

-- CreateEnum
CREATE TYPE "ResumeStatus" AS ENUM ('uploaded', 'parsed', 'failed');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('demonstrated', 'mentioned', 'self_reported', 'assessed');

-- CreateEnum
CREATE TYPE "JdSource" AS ENUM ('pasted', 'file', 'url');

-- CreateEnum
CREATE TYPE "RequirementKind" AS ENUM ('must', 'nice');

-- CreateEnum
CREATE TYPE "RequirementCategory" AS ENUM ('must_have', 'good_to_have', 'advanced', 'domain');

-- CreateEnum
CREATE TYPE "GapStatus" AS ENUM ('matched', 'partial', 'missing');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('draft', 'active', 'superseded', 'completed');

-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('learn', 'exercise', 'coding', 'assessment', 'project_milestone');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'doing', 'done', 'skipped', 'missed');

-- CreateEnum
CREATE TYPE "ProjectTier" AS ENUM ('beginner', 'intermediate', 'advanced', 'production');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('suggested', 'in_progress', 'done', 'dropped');

-- CreateEnum
CREATE TYPE "InterviewKind" AS ENUM ('technical', 'coding', 'system_design', 'behavioral', 'role_specific', 'scenario', 'mixed');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('in_progress', 'completed', 'abandoned');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('technical', 'coding', 'behavioral', 'system_design', 'scenario');

-- CreateEnum
CREATE TYPE "ProgressKind" AS ENUM ('task_completed', 'task_missed', 'hours_logged', 'assessment_scored', 'interview_scored', 'project_milestone', 'skill_level_changed', 'plan_revised');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('saved', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'ghosted', 'withdrawn');

-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('referral', 'job_board', 'company_site', 'recruiter', 'other');

-- CreateEnum
CREATE TYPE "AiCallOutcome" AS ENUM ('ok', 'fallback', 'cache_hit', 'invalid', 'rate_limited', 'error', 'budget_exceeded');

-- DropForeignKey
ALTER TABLE "portfolio_projects" DROP CONSTRAINT "portfolio_projects_planId_fkey";

-- DropForeignKey
ALTER TABLE "interview_sessions" DROP CONSTRAINT "interview_sessions_targetRoleId_fkey";

-- DropForeignKey
ALTER TABLE "progress_logs" DROP CONSTRAINT "progress_logs_userId_fkey";

-- DropForeignKey
ALTER TABLE "progress_logs" DROP CONSTRAINT "progress_logs_taskId_fkey";

-- DropForeignKey
ALTER TABLE "skill_levels" DROP CONSTRAINT "skill_levels_userId_fkey";

-- DropForeignKey
ALTER TABLE "skill_levels" DROP CONSTRAINT "skill_levels_skillId_fkey";

-- DropIndex
DROP INDEX "job_descriptions_targetRoleId_contentHash_key";

-- DropIndex
DROP INDEX "gap_analyses_targetRoleId_createdAt_idx";

-- DropIndex
DROP INDEX "plan_tasks_weekId_idx";

-- DropIndex
DROP INDEX "interview_questions_sessionId_idx";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "careerGoal" TEXT,
ADD COLUMN     "currentRole" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "onboardedAt" TIMESTAMPTZ(6),
ADD COLUMN     "salaryExpectation" TEXT,
ADD COLUMN     "yearsExperience" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "resumes" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parseError" TEXT,
ADD COLUMN     "status" "ResumeStatus" NOT NULL DEFAULT 'uploaded';

-- AlterTable
ALTER TABLE "target_roles" ADD COLUMN     "horizonWeeks" INTEGER,
ADD COLUMN     "hoursPerWeek" INTEGER,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "roleTrackId" UUID,
ADD COLUMN     "salaryExpectation" TEXT;

-- AlterTable
ALTER TABLE "job_descriptions" ADD COLUMN     "source" "JdSource" NOT NULL DEFAULT 'pasted',
ADD COLUMN     "userId" UUID NOT NULL,
ALTER COLUMN "targetRoleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "gap_analyses" DROP COLUMN "items",
ADD COLUMN     "candidate" JSONB,
ADD COLUMN     "jdCount" INTEGER NOT NULL,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "promptVersion" TEXT,
ADD COLUMN     "recommendations" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "userId" UUID NOT NULL,
ALTER COLUMN "targetRoleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "learning_plans" ADD COLUMN     "changeSummary" JSONB,
ADD COLUMN     "durationWeeks" INTEGER NOT NULL,
ADD COLUMN     "hoursPerWeek" INTEGER NOT NULL,
ADD COLUMN     "parentId" UUID,
DROP COLUMN "status",
ADD COLUMN     "status" "PlanStatus" NOT NULL DEFAULT 'active',
ALTER COLUMN "startDate" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "plan_weeks" ADD COLUMN     "content" JSONB,
ADD COLUMN     "objectives" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "startDate" DATE;

-- AlterTable
ALTER TABLE "plan_tasks" DROP COLUMN "skill",
ADD COLUMN     "dueDate" DATE,
ADD COLUMN     "hoursSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "kind" "TaskKind" NOT NULL DEFAULT 'learn',
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resourceId" UUID,
ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "skillId" UUID,
ADD COLUMN     "userId" UUID NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "TaskStatus" NOT NULL DEFAULT 'todo';

-- AlterTable
ALTER TABLE "portfolio_projects" DROP COLUMN "milestones",
ADD COLUMN     "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "gapAnalysisId" UUID,
ADD COLUMN     "repoUrl" TEXT,
ADD COLUMN     "spec" JSONB,
ADD COLUMN     "tier" "ProjectTier" NOT NULL,
ADD COLUMN     "userId" UUID NOT NULL,
ALTER COLUMN "planId" DROP NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "ProjectStatus" NOT NULL DEFAULT 'suggested';

-- AlterTable
ALTER TABLE "interview_sessions" ADD COLUMN     "completedAt" TIMESTAMPTZ(6),
ADD COLUMN     "kind" "InterviewKind" NOT NULL DEFAULT 'mixed',
ADD COLUMN     "rubricVersion" TEXT,
ADD COLUMN     "status" "InterviewStatus" NOT NULL DEFAULT 'in_progress',
ADD COLUMN     "summary" JSONB,
ADD COLUMN     "targetRoleTitle" TEXT,
ALTER COLUMN "targetRoleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "interview_questions" DROP COLUMN "feedback",
DROP COLUMN "modelAnswer",
DROP COLUMN "scores",
DROP COLUMN "skill",
ADD COLUMN     "answeredAt" TIMESTAMPTZ(6),
ADD COLUMN     "parentId" UUID,
ADD COLUMN     "seq" INTEGER NOT NULL,
ADD COLUMN     "skillId" UUID,
ADD COLUMN     "userId" UUID NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "QuestionType" NOT NULL;

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "followUpAt" DATE,
ADD COLUMN     "jobDescriptionId" UUID,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "referral" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resumeId" UUID,
DROP COLUMN "source",
ADD COLUMN     "source" "ApplicationSource",
DROP COLUMN "status",
ADD COLUMN     "status" "ApplicationStatus" NOT NULL DEFAULT 'applied';

-- DropTable
DROP TABLE "progress_logs";

-- DropTable
DROP TABLE "skill_levels";

-- CreateTable
CREATE TABLE "user_skills" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "level" SMALLINT NOT NULL,
    "evidenceType" "EvidenceType" NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "confidence" DOUBLE PRECISION,
    "confirmedByUser" BOOLEAN NOT NULL DEFAULT false,
    "sourceResumeId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_requirements" (
    "id" UUID NOT NULL,
    "jobDescriptionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "skillId" UUID,
    "skillName" TEXT NOT NULL,
    "kind" "RequirementKind" NOT NULL,
    "category" "RequirementCategory",
    "requiredLevel" SMALLINT,
    "minYears" DOUBLE PRECISION,
    "evidenceQuote" TEXT,

    CONSTRAINT "job_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gap_analysis_jobs" (
    "analysisId" UUID NOT NULL,
    "jobDescriptionId" UUID NOT NULL,

    CONSTRAINT "gap_analysis_jobs_pkey" PRIMARY KEY ("analysisId","jobDescriptionId")
);

-- CreateTable
CREATE TABLE "gap_items" (
    "id" UUID NOT NULL,
    "analysisId" UUID NOT NULL,
    "skillId" UUID,
    "skillName" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "demand" DOUBLE PRECISION NOT NULL,
    "have" DOUBLE PRECISION NOT NULL,
    "gap" DOUBLE PRECISION NOT NULL,
    "status" "GapStatus" NOT NULL,
    "currentLevel" SMALLINT,
    "requiredLevel" SMALLINT,
    "priority" DOUBLE PRECISION,
    "category" "RequirementCategory",
    "evidence" TEXT,

    CONSTRAINT "gap_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_evaluations" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "criteria" JSONB NOT NULL,
    "strengths" JSONB NOT NULL DEFAULT '[]',
    "improvements" JSONB NOT NULL DEFAULT '[]',
    "missingConcepts" JSONB NOT NULL DEFAULT '[]',
    "modelAnswer" TEXT,
    "model" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "ProgressKind" NOT NULL,
    "taskId" UUID,
    "skillId" UUID,
    "refId" UUID,
    "hours" DOUBLE PRECISION,
    "value" DOUBLE PRECISION,
    "note" TEXT,
    "meta" JSONB,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_events" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "stage" "ApplicationStatus" NOT NULL,
    "rejectionReason" TEXT,
    "feedback" TEXT,
    "notes" TEXT,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_calls" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "task" TEXT NOT NULL,
    "promptVersion" TEXT,
    "inputHash" TEXT NOT NULL,
    "model" TEXT,
    "outcome" "AiCallOutcome" NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "costUsd" DECIMAL(12,6),
    "latencyMs" INTEGER,
    "error" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_skills_skillId_idx" ON "user_skills"("skillId");

-- CreateIndex
CREATE INDEX "user_skills_sourceResumeId_idx" ON "user_skills"("sourceResumeId");

-- CreateIndex
CREATE UNIQUE INDEX "user_skills_userId_skillId_key" ON "user_skills"("userId", "skillId");

-- CreateIndex
CREATE INDEX "job_requirements_jobDescriptionId_idx" ON "job_requirements"("jobDescriptionId");

-- CreateIndex
CREATE INDEX "job_requirements_userId_skillId_idx" ON "job_requirements"("userId", "skillId");

-- CreateIndex
CREATE INDEX "job_requirements_skillId_idx" ON "job_requirements"("skillId");

-- CreateIndex
CREATE INDEX "gap_analysis_jobs_jobDescriptionId_idx" ON "gap_analysis_jobs"("jobDescriptionId");

-- CreateIndex
CREATE INDEX "gap_items_skillId_idx" ON "gap_items"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "gap_items_analysisId_position_key" ON "gap_items"("analysisId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "interview_evaluations_questionId_key" ON "interview_evaluations"("questionId");

-- CreateIndex
CREATE INDEX "interview_evaluations_userId_createdAt_idx" ON "interview_evaluations"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "progress_events_userId_occurredAt_idx" ON "progress_events"("userId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "progress_events_userId_skillId_kind_idx" ON "progress_events"("userId", "skillId", "kind");

-- CreateIndex
CREATE INDEX "progress_events_taskId_idx" ON "progress_events"("taskId");

-- CreateIndex
CREATE INDEX "progress_events_skillId_idx" ON "progress_events"("skillId");

-- CreateIndex
CREATE INDEX "application_events_applicationId_occurredAt_idx" ON "application_events"("applicationId", "occurredAt");

-- CreateIndex
CREATE INDEX "application_events_userId_idx" ON "application_events"("userId");

-- CreateIndex
CREATE INDEX "ai_calls_userId_createdAt_idx" ON "ai_calls"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ai_calls_task_inputHash_idx" ON "ai_calls"("task", "inputHash");

-- CreateIndex
CREATE INDEX "target_roles_roleTrackId_idx" ON "target_roles"("roleTrackId");

-- CreateIndex
CREATE UNIQUE INDEX "job_descriptions_userId_contentHash_key" ON "job_descriptions"("userId", "contentHash");

-- CreateIndex
CREATE INDEX "gap_analyses_userId_createdAt_idx" ON "gap_analyses"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "gap_analyses_targetRoleId_idx" ON "gap_analyses"("targetRoleId");

-- CreateIndex
CREATE INDEX "learning_plans_userId_status_idx" ON "learning_plans"("userId", "status");

-- CreateIndex
CREATE INDEX "learning_plans_parentId_idx" ON "learning_plans"("parentId");

-- CreateIndex
CREATE INDEX "plan_tasks_weekId_position_idx" ON "plan_tasks"("weekId", "position");

-- CreateIndex
CREATE INDEX "plan_tasks_userId_status_idx" ON "plan_tasks"("userId", "status");

-- CreateIndex
CREATE INDEX "plan_tasks_skillId_idx" ON "plan_tasks"("skillId");

-- CreateIndex
CREATE INDEX "plan_tasks_resourceId_idx" ON "plan_tasks"("resourceId");

-- CreateIndex
CREATE INDEX "portfolio_projects_userId_status_idx" ON "portfolio_projects"("userId", "status");

-- CreateIndex
CREATE INDEX "portfolio_projects_gapAnalysisId_idx" ON "portfolio_projects"("gapAnalysisId");

-- CreateIndex
CREATE INDEX "interview_questions_userId_idx" ON "interview_questions"("userId");

-- CreateIndex
CREATE INDEX "interview_questions_parentId_idx" ON "interview_questions"("parentId");

-- CreateIndex
CREATE INDEX "interview_questions_skillId_idx" ON "interview_questions"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_questions_sessionId_seq_key" ON "interview_questions"("sessionId", "seq");

-- CreateIndex
CREATE INDEX "applications_userId_status_idx" ON "applications"("userId", "status");

-- CreateIndex
CREATE INDEX "applications_userId_appliedAt_idx" ON "applications"("userId", "appliedAt" DESC);

-- CreateIndex
CREATE INDEX "applications_jobDescriptionId_idx" ON "applications"("jobDescriptionId");

-- CreateIndex
CREATE INDEX "applications_resumeId_idx" ON "applications"("resumeId");

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_sourceResumeId_fkey" FOREIGN KEY ("sourceResumeId") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_roles" ADD CONSTRAINT "target_roles_roleTrackId_fkey" FOREIGN KEY ("roleTrackId") REFERENCES "role_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analyses" ADD CONSTRAINT "gap_analyses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analysis_jobs" ADD CONSTRAINT "gap_analysis_jobs_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "gap_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analysis_jobs" ADD CONSTRAINT "gap_analysis_jobs_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_items" ADD CONSTRAINT "gap_items_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "gap_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_items" ADD CONSTRAINT "gap_items_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_plans" ADD CONSTRAINT "learning_plans_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "learning_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "learning_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_gapAnalysisId_fkey" FOREIGN KEY ("gapAnalysisId") REFERENCES "gap_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_planId_fkey" FOREIGN KEY ("planId") REFERENCES "learning_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_targetRoleId_fkey" FOREIGN KEY ("targetRoleId") REFERENCES "target_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "interview_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_evaluations" ADD CONSTRAINT "interview_evaluations_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "interview_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_evaluations" ADD CONSTRAINT "interview_evaluations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "plan_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "job_descriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_calls" ADD CONSTRAINT "ai_calls_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same policy as 20261031120100_supabase_security: RLS on, no policies, so the
-- Supabase Data API (anon/publishable key) cannot read or write these tables.
ALTER TABLE "user_skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_requirements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gap_analysis_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gap_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interview_evaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "progress_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "application_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_calls" ENABLE ROW LEVEL SECURITY;
