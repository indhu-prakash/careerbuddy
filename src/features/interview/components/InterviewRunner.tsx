"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { apiError, KIND_LABELS, type Evaluation, type Question, type Session } from "../types";
import { EvaluationCard } from "./EvaluationCard";
import { QuestionBadges, QuestionReview } from "./QuestionReview";
import { RubricList } from "./RubricList";
import { SessionReport } from "./SessionReport";
import { VoiceRecorder } from "./VoiceRecorder";

type Scored = { question: Question; evaluation: Evaluation; followedUp: boolean };

/**
 * Runs a saved session one question at a time: shows the rubric, scores each answer on
 * submit (so there's no long wait at the end), then shows the report once finished.
 */
export function InterviewRunner({ initial }: { initial: Session }) {
  const [session, setSession] = useState(initial);
  const current = session.questions.find((q) => q.id === session.nextQuestionId) ?? null;
  // A saved but unscored answer (scoring failed earlier) is restored for retry.
  const [answer, setAnswer] = useState(current?.answer ?? "");
  const [busy, setBusy] = useState<"scoring" | "finishing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scored, setScored] = useState<Scored | null>(null);

  const total = session.questions.length;

  async function submit(question: Question) {
    setBusy("scoring");
    setError(null);
    try {
      const res = await fetch(`/api/v1/interviews/${session.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, answer }),
      });
      if (!res.ok) throw new Error(await apiError(res, "Scoring failed. Your answer is saved; try again."));
      const body = await res.json();
      setScored({ question, evaluation: body.evaluation, followedUp: body.followedUp });
      setSession(body.session);
      setAnswer(body.nextQuestion?.answer ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function finish() {
    setBusy("finishing");
    setError(null);
    try {
      const res = await fetch(`/api/v1/interviews/${session.id}/complete`, { method: "POST" });
      if (!res.ok) throw new Error(await apiError(res, "Couldn't build the report. Try again."));
      setSession(await res.json());
      setScored(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const finishButton = (variant: "primary" | "outline") => (
    <Button variant={variant} onClick={finish} disabled={busy !== null || session.answered === 0}>
      {busy === "finishing" ? "Writing your report… (up to a minute)" : "Finish and see report"}
    </Button>
  );

  return (
    <div className="mt-6 grid gap-5">
      <Card className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="font-medium">
            {session.targetRoleTitle ?? "Mock interview"} · {KIND_LABELS[session.kind] ?? session.kind}
          </div>
          <div className="text-sm text-muted-foreground">
            {session.answered}/{total} answered
          </div>
        </div>
        <ProgressBar value={total ? (session.answered / total) * 100 : 0} label="Interview progress" />
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {session.status === "completed" && session.summary && <SessionReport summary={session.summary} />}
      {session.status === "abandoned" && (
        <Alert tone="warning">This interview was closed before any answer was scored.</Alert>
      )}

      {session.status === "in_progress" && scored && (
        <Card className="grid gap-5">
          <div className="grid gap-2">
            <QuestionBadges question={scored.question} />
            <p className="text-sm text-muted-foreground">{scored.question.question}</p>
          </div>
          <EvaluationCard evaluation={scored.evaluation} />
          {scored.followedUp && (
            <Alert>One criterion scored 2 or lower, so your interviewer has a follow-up question.</Alert>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            {current ? <Button onClick={() => setScored(null)}>Next question</Button> : finishButton("primary")}
          </div>
        </Card>
      )}

      {session.status === "in_progress" && !scored && current && (
        <Card className="grid gap-5">
          <div className="grid gap-2">
            <QuestionBadges question={current} />
            <h2 className="font-display text-lg font-bold text-pretty">{current.question}</h2>
          </div>
          <RubricList rubric={current.rubric} />
          <div className="grid gap-2">
            <span className="text-sm font-medium">Your answer</span>
            <VoiceRecorder onTranscript={(text) => setAnswer((prev) => (prev ? `${prev} ${text}` : text))} />
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={8}
              aria-label="Your answer"
              placeholder="Record your answer, or type it here. You can correct the transcript before submitting."
              disabled={busy === "scoring"}
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => submit(current)} disabled={busy !== null || !answer.trim()}>
              {busy === "scoring" ? "Scoring… (up to a minute)" : "Submit answer"}
            </Button>
            {session.answered > 0 && finishButton("outline")}
          </div>
        </Card>
      )}

      {session.status === "in_progress" && !scored && !current && (
        <Card className="grid gap-3">
          <p>All questions are answered. Finish to see your session report.</p>
          <div>{finishButton("primary")}</div>
        </Card>
      )}

      {session.answered > 0 && (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Your answers</h2>
          <QuestionReview questions={session.questions} />
        </section>
      )}

      {session.status !== "in_progress" && (
        <ButtonLink href="/interview" variant="outline" className="sm:justify-self-start">
          Start another interview
        </ButtonLink>
      )}
    </div>
  );
}
