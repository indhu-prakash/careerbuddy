-- Skill taxonomy: topics per tier, prerequisite/related graph, learning resources,
-- and role tracks. Data comes from prisma/seed (npm run db:seed).

-- CreateEnum
CREATE TYPE "SkillTier" AS ENUM ('fundamental', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "EdgeKind" AS ENUM ('prereq', 'related');

-- CreateEnum
CREATE TYPE "RoleSkillImportance" AS ENUM ('core', 'recommended');

-- AlterTable
-- slug is added nullable, backfilled for any skills created before this migration
-- (id suffix avoids collisions), then made NOT NULL. The seed re-slugs curated rows.
ALTER TABLE "skills" ADD COLUMN     "curated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "slug" TEXT;
UPDATE "skills"
SET "slug" = trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9#+]+', '-', 'g')) || '-' || left("id"::text, 8)
WHERE "slug" IS NULL;
ALTER TABLE "skills" ALTER COLUMN "slug" SET NOT NULL;

-- CreateTable
CREATE TABLE "skill_topics" (
    "id" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "tier" "SkillTier" NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "skill_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_edges" (
    "fromSkillId" UUID NOT NULL,
    "toSkillId" UUID NOT NULL,
    "kind" "EdgeKind" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "skill_edges_pkey" PRIMARY KEY ("fromSkillId","toSkillId","kind")
);

-- CreateTable
CREATE TABLE "learning_resources" (
    "id" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tier" "SkillTier" NOT NULL,
    "curated" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "learning_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_tracks" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT NOT NULL,

    CONSTRAINT "role_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_track_skills" (
    "trackId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "tier" "SkillTier" NOT NULL,
    "requiredLevel" SMALLINT NOT NULL,
    "importance" "RoleSkillImportance" NOT NULL DEFAULT 'core',
    "choiceGroup" TEXT,

    CONSTRAINT "role_track_skills_pkey" PRIMARY KEY ("trackId","skillId")
);

-- CreateIndex
CREATE UNIQUE INDEX "skill_topics_skillId_tier_position_key" ON "skill_topics"("skillId", "tier", "position");

-- CreateIndex
CREATE INDEX "skill_edges_toSkillId_idx" ON "skill_edges"("toSkillId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_resources_skillId_url_key" ON "learning_resources"("skillId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "role_tracks_slug_key" ON "role_tracks"("slug");

-- CreateIndex
CREATE INDEX "role_tracks_aliases_idx" ON "role_tracks" USING GIN ("aliases");

-- CreateIndex
CREATE INDEX "role_track_skills_skillId_idx" ON "role_track_skills"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "skills_slug_key" ON "skills"("slug");

-- CreateIndex
CREATE INDEX "skills_aliases_idx" ON "skills" USING GIN ("aliases");

-- AddForeignKey
ALTER TABLE "skill_topics" ADD CONSTRAINT "skill_topics_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_edges" ADD CONSTRAINT "skill_edges_fromSkillId_fkey" FOREIGN KEY ("fromSkillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_edges" ADD CONSTRAINT "skill_edges_toSkillId_fkey" FOREIGN KEY ("toSkillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_track_skills" ADD CONSTRAINT "role_track_skills_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "role_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_track_skills" ADD CONSTRAINT "role_track_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Range checks the Prisma schema can't express.
ALTER TABLE "skill_topics" ADD CONSTRAINT "skill_topics_position_check" CHECK ("position" >= 0);
ALTER TABLE "role_track_skills" ADD CONSTRAINT "role_track_skills_required_level_check" CHECK ("requiredLevel" BETWEEN 1 AND 4);
ALTER TABLE "skill_edges" ADD CONSTRAINT "skill_edges_no_self_loop_check" CHECK ("fromSkillId" <> "toSkillId");

-- Same hardening as 20261031120100_supabase_security: RLS on with no policies closes
-- the Supabase Data API; the app reads these tables through Prisma on the server.
ALTER TABLE "skill_topics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_edges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "learning_resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_tracks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_track_skills" ENABLE ROW LEVEL SECURITY;
