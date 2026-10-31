import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { cleanRoleTitle, matchRoleTrack } from "@/lib/skills/roles";
import { RESPONSE_STAGES, type AppStatus } from "@/lib/scoring/applications";
import type { CreateApplicationInput, CreateEventInput, UpdateApplicationInput } from "./schemas";

export class ApplicationInputError extends Error {
  constructor(readonly code: "invalid_job_description" | "invalid_resume" | "missing_company" | "missing_role_title") {
    super(code);
  }
}

export const applicationSelect = {
  id: true,
  jobDescriptionId: true,
  resumeId: true,
  company: true,
  roleTitle: true,
  roleFamily: true,
  seniority: true,
  industry: true,
  companySize: true,
  location: true,
  source: true,
  referral: true,
  tailored: true,
  matchScore: true,
  status: true,
  appliedAt: true,
  respondedAt: true,
  followUpAt: true,
  notes: true,
  jobDescription: { select: { id: true, title: true, company: true } },
  resume: { select: { id: true, fileName: true } },
} satisfies Prisma.ApplicationSelect;

export const eventSelect = {
  id: true,
  stage: true,
  rejectionReason: true,
  feedback: true,
  notes: true,
  occurredAt: true,
} satisfies Prisma.ApplicationEventSelect;

const toDate = (v: string | undefined) => (v ? new Date(v) : undefined);
// followUpAt is a @db.Date column; parse as UTC midnight so the day doesn't shift.
const toDay = (v: string | null | undefined) => (v === undefined ? undefined : v ? new Date(`${v}T00:00:00Z`) : null);

type JdFacts = {
  company: string | null;
  title: string | null;
  matchScore: number | null;
  roleFamily: string | null;
  seniority: string | null;
  industry: string | null;
};

/**
 * What a linked JD tells us: company/title, the match score of the latest gap analysis
 * that included it (frozen onto the application), and the target role's family.
 * Null when the JD isn't the user's.
 */
async function jdFacts(userId: string, jobDescriptionId: string): Promise<JdFacts | null> {
  const jd = await db.jobDescription.findFirst({
    where: { id: jobDescriptionId, userId },
    select: {
      company: true,
      title: true,
      targetRole: { select: { seniority: true, industry: true, roleTrack: { select: { family: true } } } },
    },
  });
  if (!jd) return null;
  const analysis = await db.gapAnalysis.findFirst({
    where: { userId, jobDescriptions: { some: { jobDescriptionId } } },
    orderBy: { createdAt: "desc" },
    select: { matchScore: true },
  });
  return {
    company: jd.company,
    title: jd.title ? cleanRoleTitle(jd.title, jd.company) : null,
    matchScore: analysis?.matchScore ?? null,
    roleFamily: jd.targetRole?.roleTrack?.family ?? null,
    seniority: jd.targetRole?.seniority ?? null,
    industry: jd.targetRole?.industry ?? null,
  };
}

/** Role family from a typed title, via the role taxonomy. */
async function familyFromTitle(title: string): Promise<string | null> {
  const tracks = await db.roleTrack.findMany({ select: { id: true, slug: true, title: true, aliases: true, family: true } });
  return matchRoleTrack(title, tracks)?.family ?? null;
}

async function assertResume(userId: string, resumeId: string | null | undefined) {
  if (!resumeId) return;
  const found = await db.resume.findFirst({ where: { id: resumeId, userId }, select: { id: true } });
  if (!found) throw new ApplicationInputError("invalid_resume");
}

export async function listApplications(userId: string, status?: AppStatus) {
  return db.application.findMany({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: { appliedAt: "desc" },
    take: 500,
    select: applicationSelect,
  });
}

export async function getApplication(userId: string, id: string) {
  return db.application.findFirst({
    where: { id, userId },
    select: { ...applicationSelect, events: { orderBy: { occurredAt: "asc" }, select: eventSelect } },
  });
}

export async function createApplication(userId: string, input: CreateApplicationInput) {
  let facts: JdFacts | null = null;
  if (input.jobDescriptionId) {
    facts = await jdFacts(userId, input.jobDescriptionId);
    if (!facts) throw new ApplicationInputError("invalid_job_description");
  }
  await assertResume(userId, input.resumeId);

  const company = input.company || facts?.company;
  const roleTitle = input.roleTitle || facts?.title;
  if (!company) throw new ApplicationInputError("missing_company");
  if (!roleTitle) throw new ApplicationInputError("missing_role_title");

  const status = input.status ?? "applied";
  const appliedAt = toDate(input.appliedAt) ?? new Date();
  const roleFamily = input.roleFamily ?? facts?.roleFamily ?? (await familyFromTitle(roleTitle));

  return db.application.create({
    data: {
      userId,
      jobDescriptionId: input.jobDescriptionId ?? null,
      resumeId: input.resumeId ?? null,
      company,
      roleTitle,
      roleFamily,
      seniority: input.seniority ?? facts?.seniority ?? null,
      industry: input.industry ?? facts?.industry ?? null,
      companySize: input.companySize ?? null,
      location: input.location ?? null,
      source: input.source ?? null,
      referral: input.referral ?? input.source === "referral",
      tailored: input.tailored ?? false,
      matchScore: facts?.matchScore ?? null,
      status,
      appliedAt,
      followUpAt: toDay(input.followUpAt) ?? null,
      notes: input.notes ?? null,
      // The starting stage is the first entry in the history.
      events: { create: { userId, stage: status, occurredAt: appliedAt } },
    },
    select: applicationSelect,
  });
}

/** Edit details. Linking a different JD re-freezes match score and role family from it. */
export async function updateApplication(userId: string, id: string, input: UpdateApplicationInput) {
  const current = await db.application.findFirst({
    where: { id, userId },
    select: { jobDescriptionId: true, roleFamily: true },
  });
  if (!current) return null;

  const data: Prisma.ApplicationUncheckedUpdateInput = {};
  for (const key of [
    "company",
    "roleTitle",
    "roleFamily",
    "seniority",
    "industry",
    "companySize",
    "location",
    "source",
    "referral",
    "tailored",
    "notes",
    "resumeId",
  ] as const) {
    if (input[key] !== undefined) (data as Record<string, unknown>)[key] = input[key];
  }
  if (input.company === "") delete data.company;
  if (input.roleTitle === "") delete data.roleTitle;
  if (input.appliedAt !== undefined) data.appliedAt = new Date(input.appliedAt);
  if (input.followUpAt !== undefined) data.followUpAt = toDay(input.followUpAt);
  await assertResume(userId, input.resumeId);

  if (input.jobDescriptionId !== undefined && input.jobDescriptionId !== current.jobDescriptionId) {
    data.jobDescriptionId = input.jobDescriptionId;
    if (input.jobDescriptionId) {
      const facts = await jdFacts(userId, input.jobDescriptionId);
      if (!facts) throw new ApplicationInputError("invalid_job_description");
      data.matchScore = facts.matchScore;
      if (input.roleFamily === undefined && facts.roleFamily) data.roleFamily = facts.roleFamily;
    } else {
      data.matchScore = null;
    }
  }
  // A renamed role with no family yet: try the taxonomy.
  if (typeof data.roleTitle === "string" && data.roleFamily === undefined && !current.roleFamily) {
    data.roleFamily = await familyFromTitle(data.roleTitle);
  }

  return db.application.update({ where: { id }, data, select: applicationSelect });
}

export async function deleteApplication(userId: string, id: string): Promise<boolean> {
  const { count } = await db.application.deleteMany({ where: { id, userId } });
  return count > 0;
}

/**
 * Record a stage change (or a note at the same stage): adds the event, moves the
 * status, sets respondedAt on the first company response and appliedAt when a saved
 * application is actually sent.
 */
export async function addEvent(userId: string, id: string, input: CreateEventInput) {
  const app = await db.application.findFirst({
    where: { id, userId },
    select: { status: true, respondedAt: true },
  });
  if (!app) return null;

  const occurredAt = toDate(input.occurredAt) ?? new Date();
  const data: Prisma.ApplicationUncheckedUpdateInput = { status: input.stage };
  if (!app.respondedAt && RESPONSE_STAGES.includes(input.stage)) data.respondedAt = occurredAt;
  if (app.status === "saved" && input.stage === "applied") data.appliedAt = occurredAt;

  const [event, application] = await db.$transaction([
    db.applicationEvent.create({
      data: {
        applicationId: id,
        userId,
        stage: input.stage,
        occurredAt,
        rejectionReason: input.rejectionReason ?? null,
        feedback: input.feedback ?? null,
        notes: input.notes ?? null,
      },
      select: eventSelect,
    }),
    db.application.update({ where: { id }, data, select: applicationSelect }),
  ]);
  return { event, application };
}

/** Link options for the form: the user's JDs (with match score if analysed) and resumes. */
export async function listLinkOptions(userId: string) {
  const [jds, resumes] = await Promise.all([
    db.jobDescription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        company: true,
        createdAt: true,
        analyses: {
          orderBy: { analysis: { createdAt: "desc" } },
          take: 1,
          select: { analysis: { select: { matchScore: true } } },
        },
      },
    }),
    db.resume.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, fileName: true, createdAt: true },
    }),
  ]);
  return {
    jobDescriptions: jds.map(({ analyses, ...jd }) => ({ ...jd, matchScore: analyses[0]?.analysis.matchScore ?? null })),
    resumes,
  };
}
