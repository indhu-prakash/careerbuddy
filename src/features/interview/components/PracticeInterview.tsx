"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { DEFAULT_RUBRICS, type QuestionType } from "@/lib/ai/prompts/interview-scoring";
import { apiError, TYPE_LABELS, type Evaluation } from "../types";
import { EvaluationCard } from "./EvaluationCard";
import { RubricList } from "./RubricList";
import { VoiceRecorder } from "./VoiceRecorder";

const SAMPLE_QUESTIONS: Record<QuestionType, string> = {
  technical: "What is the difference between a process and a thread, and when would you use each?",
  coding: "Write a function that returns the first non-repeating character in a string. What is its complexity?",
  behavioral: "Tell me about a time you had to learn a new technology quickly to deliver a project.",
  system_design: "Design a URL shortener that handles 10 million new links per day.",
  scenario: "A release you shipped yesterday doubled the error rate in production. What do you do in the first hour?",
};

/** One-off practice: any question, scored statelessly (nothing is saved). */
export function PracticeInterview({ defaultTargetRole = "" }: { defaultTargetRole?: string }) {
  const [type, setType] = useState<QuestionType>("behavioral");
  const [question, setQuestion] = useState(SAMPLE_QUESTIONS.behavioral);
  const [targetRole, setTargetRole] = useState(defaultTargetRole);
  const [answer, setAnswer] = useState("");
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Evaluation | null>(null);

  async function score() {
    setScoring(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/interview/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, type, answer, targetRole: targetRole.trim() || undefined }),
      });
      if (!res.ok) throw new Error(await apiError(res, "Scoring failed. Try again."));
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScoring(false);
    }
  }

  return (
    <div className="mt-6 grid gap-5">
      <Card className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Question type">
            <Select
              value={type}
              onChange={(e) => {
                const t = e.target.value as QuestionType;
                setType(t);
                setQuestion(SAMPLE_QUESTIONS[t]);
              }}
            >
              {Object.keys(SAMPLE_QUESTIONS).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target role" hint="Optional. Scoring is pitched at this role.">
            <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} maxLength={200} />
          </Field>
        </div>

        <Field label="Question">
          <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} />
        </Field>

        <RubricList rubric={DEFAULT_RUBRICS[type]} />

        <div className="grid gap-2">
          <span className="text-sm font-medium">Your answer</span>
          <VoiceRecorder onTranscript={(text) => setAnswer((prev) => (prev ? `${prev} ${text}` : text))} />
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={8}
            aria-label="Your answer"
            placeholder="Record your answer, or type it here. You can correct the transcript before scoring."
          />
        </div>

        <Button
          onClick={score}
          disabled={scoring || question.trim().length < 5 || !answer.trim()}
          className="sm:justify-self-start"
        >
          {scoring ? "Scoring… (up to a minute)" : "Score my answer"}
        </Button>
        {error && <Alert tone="danger">{error}</Alert>}
      </Card>

      {result && (
        <Card>
          <EvaluationCard evaluation={result} />
        </Card>
      )}
    </div>
  );
}
