import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { DEFAULT_RUBRICS, RUBRIC_VERSION, type RubricCriterion } from "@/lib/ai/prompts/interview-scoring";
import { loadGapContext } from "@/lib/analysis/load";
import { recordProgress } from "@/lib/progress/record";
import { buildSessionReport, type SessionReport } from "@/lib/scoring/interview";
import { evaluateAnswer } from "./evaluate";
import { generateQuestions } from "./generate";
import {
  followUpText,
  orderQuestions,
  pickFocusSkills,
  planSlots,
  shouldFollowUp,
  type InterviewKind,
} from "./plan";
import { summarizeSession, type SessionNarrative } from "./summary";

/** Expected failures, mapped to HTTP responses by the routes. */
export class InterviewError extends Error {
  constructor(
    readonly code: "not_found" | "target_role_required" | "session_closed" | "already_answered",
    readonly status: 400 | 404 | 409,
  ) {
    super(code);
  }
}

/** Stored on InterviewSession.summary when a session is completed. */
export type SessionSummaryJson = SessionReport & SessionNarrative;

const RubricSchema = z.array(z.object({ criterion: z.string(), description: z.string() })).min(1);

function rubricOf(q: { rubric: unknown; type: keyof typeof DEFAULT_RUBRICS }): RubricCriterion[] {
  const parsed = RubricSchema.safeParse(q.rubric);
  return parsed.success ? parsed.data : DEFAULT_RUBRICS[q.type];
}

// ── Create ──────────────────────────────────────────────────────────────────

/**
 * Create a session and generate all its questions in one LLM call. The target role is
 * the given saved role, else a typed title (no gap targeting), else the role of the
 * latest gap analysis. Questions target that role's biggest gaps.
 */
export async function createSession(
  userId: string,
  opts: { targetRoleId?: string; targetRoleTitle?: string; kind: InterviewKind; count: number },
): Promise<{ id: string }> {
  let role: { id: string | null; title: string; seniority: string | null; track: string | null };
  let ctx: Awaited<ReturnType<typeof loadGapContext>> = null;

  if (opts.targetRoleId) {
    const saved = await db.targetRole.findFirst({
      where: { id: opts.targetRoleId, userId },
      select: { id: true, title: true, seniority: true, roleTrack: { select: { title: true } } },
    });
    if (!saved) throw new InterviewError("not_found", 404);
    role = { id: saved.id, title: saved.title, seniority: saved.seniority, track: saved.roleTrack?.title ?? null };
    const analysis = await db.gapAnalysis.findFirst({
      where: { userId, targetRoleId: saved.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (analysis) ctx = await loadGapContext(userId, analysis.id);
  } else if (opts.targetRoleTitle) {
    role = { id: null, title: opts.targetRoleTitle, seniority: null, track: null };
  } else {
    ctx = await loadGapContext(userId);
    const r = ctx?.targetRole;
    if (!r) throw new InterviewError("target_role_required", 400);
    role = { id: r.id, title: r.title, seniority: r.seniority, track: r.roleTrack?.title ?? null };
  }

  const slots = planSlots(opts.kind, opts.count, pickFocusSkills(ctx?.items ?? []));

  // Recent questions for the same role, so a new session doesn't repeat them.
  const recent = await db.interviewQuestion.findMany({
    where: {
      userId,
      parentId: null,
      session: role.id ? { targetRoleId: role.id } : { targetRoleTitle: role.title },
    },
    orderBy: { session: { createdAt: "desc" } },
    take: 15,
    select: { question: true },
  });

  const { questions } = await generateQuestions({
    userId,
    targetRole: role.title,
    seniority: role.seniority,
    track: role.track,
    slots,
    avoid: recent.map((q) => q.question),
  });

  return db.interviewSession.create({
    data: {
      userId,
      targetRoleId: role.id,
      targetRoleTitle: role.title,
      kind: opts.kind,
      rubricVersion: RUBRIC_VERSION,
      questions: {
        create: questions.map((q, i) => ({
          userId,
          seq: i + 1,
          type: q.type,
          question: q.question,
          rubric: DEFAULT_RUBRICS[q.type],
          skillId: q.skillId,
        })),
      },
    },
    select: { id: true },
  });
}

// ── Read ────────────────────────────────────────────────────────────────────

const questionSelect = {
  id: true,
  parentId: true,
  seq: true,
  type: true,
  question: true,
  rubric: true,
  answer: true,
  answeredAt: true,
  skill: { select: { id: true, name: true } },
  evaluation: {
    select: {
      overallScore: true,
      criteria: true,
      strengths: true,
      improvements: true,
      missingConcepts: true,
      modelAnswer: true,
      createdAt: true,
    },
  },
} satisfies Prisma.InterviewQuestionSelect;

/** A session with its questions in asking order and the next one to answer. Null if not the user's. */
export async function getSessionView(userId: string, id: string) {
  const session = await db.interviewSession.findFirst({
    where: { id, userId },
    select: {
      id: true,
      kind: true,
      status: true,
      targetRoleId: true,
      targetRoleTitle: true,
      rubricVersion: true,
      overallScore: true,
      summary: true,
      createdAt: true,
      completedAt: true,
      questions: { select: questionSelect },
    },
  });
  if (!session) return null;
  const questions = orderQuestions(session.questions).map((q) => ({ ...q, rubric: rubricOf(q) }));
  const next = session.status === "in_progress" ? questions.find((q) => !q.evaluation) : undefined;
  return {
    ...session,
    summary: session.summary as SessionSummaryJson | null,
    questions,
    nextQuestionId: next?.id ?? null,
    answered: questions.filter((q) => q.evaluation).length,
  };
}

export type SessionView = NonNullable<Awaited<ReturnType<typeof getSessionView>>>;
export type QuestionView = SessionView["questions"][number];

/** The user's sessions, newest first. */
export async function listSessions(userId: string) {
  const sessions = await db.interviewSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      kind: true,
      status: true,
      targetRoleTitle: true,
      overallScore: true,
      createdAt: true,
      completedAt: true,
      questions: { select: { evaluation: { select: { id: true } } } },
    },
  });
  return sessions.map(({ questions, ...s }) => ({
    ...s,
    questionCount: questions.length,
    answered: questions.filter((q) => q.evaluation).length,
  }));
}

export type SessionListItem = Awaited<ReturnType<typeof listSessions>>[number];

// ── Answer ──────────────────────────────────────────────────────────────────

/**
 * Score one answer as soon as it's submitted (one LLM call), save the evaluation, ask a
 * follow-up when the code rule says so, and feed the score into the skill's progress.
 * The answer is saved before scoring so a failed call can be retried without retyping.
 */
export async function submitAnswer(userId: string, sessionId: string, questionId: string, answer: string) {
  const q = await db.interviewQuestion.findFirst({
    where: { id: questionId, sessionId, userId },
    select: {
      id: true,
      parentId: true,
      skillId: true,
      type: true,
      question: true,
      rubric: true,
      evaluation: { select: { id: true } },
      parent: { select: { question: true } },
      session: { select: { status: true, targetRoleTitle: true } },
    },
  });
  if (!q) throw new InterviewError("not_found", 404);
  if (q.session.status !== "in_progress") throw new InterviewError("session_closed", 409);
  if (q.evaluation) throw new InterviewError("already_answered", 409);

  await db.interviewQuestion.update({ where: { id: q.id }, data: { answer, answeredAt: new Date() } });

  const evaluation = await evaluateAnswer({
    question: q.question,
    type: q.type,
    answer,
    rubric: rubricOf(q),
    targetRole: q.session.targetRoleTitle ?? undefined,
    parentQuestion: q.parent?.question,
    userId,
  });

  const [followUpsSoFar, maxSeq] = await Promise.all([
    db.interviewQuestion.count({ where: { sessionId, parentId: { not: null } } }),
    db.interviewQuestion.aggregate({ where: { sessionId }, _max: { seq: true } }),
  ]);
  const followUp = shouldFollowUp({ parentId: q.parentId, criteria: evaluation.criteria, followUpsSoFar });

  try {
    await db.$transaction([
      db.interviewEvaluation.create({
        data: {
          questionId: q.id,
          userId,
          overallScore: evaluation.overallScore,
          criteria: evaluation.criteria,
          strengths: evaluation.strengths,
          improvements: evaluation.improvements,
          missingConcepts: evaluation.missingConcepts,
          modelAnswer: evaluation.modelAnswer,
          model: evaluation.model,
          promptVersion: evaluation.promptVersion,
        },
      }),
      ...(followUp
        ? [
            db.interviewQuestion.create({
              data: {
                sessionId,
                userId,
                parentId: q.id,
                skillId: q.skillId,
                seq: (maxSeq._max.seq ?? 0) + 1,
                type: q.type,
                question: followUpText(evaluation.followUp, evaluation.criteria),
                rubric: rubricOf(q),
              },
            }),
          ]
        : []),
    ]);
  } catch (error) {
    // A concurrent submit of the same question already saved its evaluation.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new InterviewError("already_answered", 409);
    }
    throw error;
  }

  if (q.skillId) {
    // The evaluation is saved; a progress failure shouldn't turn the answer into an error.
    try {
      await recordProgress({
        userId,
        kind: "interview_scored",
        skillId: q.skillId,
        refId: q.id,
        value: evaluation.overallScore / 100,
        meta: { sessionId },
      });
    } catch (error) {
      console.error("[interview] could not record progress", error);
    }
  }

  return { evaluation, followedUp: followUp };
}

// ── Complete ────────────────────────────────────────────────────────────────

/**
 * Close a session: aggregate the scored answers in code (session score, recurring
 * weaknesses, weak skills, missing concepts) and add a one-call narrative. A session
 * with no scored answers is marked abandoned without an AI call. Idempotent.
 */
export async function completeSession(userId: string, sessionId: string) {
  const session = await db.interviewSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      status: true,
      targetRoleTitle: true,
      questions: {
        orderBy: { seq: "asc" },
        select: {
          type: true,
          question: true,
          skillId: true,
          skill: { select: { name: true } },
          evaluation: { select: { overallScore: true, criteria: true, improvements: true, missingConcepts: true } },
        },
      },
    },
  });
  if (!session) throw new InterviewError("not_found", 404);
  if (session.status !== "in_progress") return;

  const scored = session.questions.flatMap((q) => (q.evaluation ? [{ ...q, evaluation: q.evaluation }] : []));
  if (scored.length === 0) {
    await db.interviewSession.update({
      where: { id: sessionId },
      data: { status: "abandoned", completedAt: new Date() },
    });
    return;
  }

  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);
  const report = buildSessionReport(
    scored.map((q) => ({
      skillId: q.skillId,
      skillName: q.skill?.name ?? null,
      overallScore: q.evaluation.overallScore,
      criteria: Array.isArray(q.evaluation.criteria) ? (q.evaluation.criteria as { criterion: string; score: number }[]) : [],
      missingConcepts: strings(q.evaluation.missingConcepts),
    })),
  );
  const narrative = await summarizeSession({
    userId,
    targetRole: session.targetRoleTitle ?? "the target role",
    report,
    answers: scored.map((q) => ({
      type: q.type,
      question: q.question,
      score: Math.round(q.evaluation.overallScore),
      improvements: strings(q.evaluation.improvements),
    })),
  });

  const summary: SessionSummaryJson = { ...report, ...narrative };
  await db.interviewSession.update({
    where: { id: sessionId },
    data: {
      status: "completed",
      completedAt: new Date(),
      overallScore: report.sessionScore,
      summary: summary as unknown as Prisma.InputJsonValue,
    },
  });
}
