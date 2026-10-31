"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { MicIcon } from "@/components/ui/icons";

// First type the browser can record. Chrome/Edge/Firefox: WebM/Opus. Safari: MP4/AAC.
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const MAX_SECONDS = 300;
// Speech is clear at 32 kbps; 5 minutes is ~1.2 MB, well under the 4 MB upload cap.
const BITS_PER_SECOND = 32_000;

type Status = "idle" | "recording" | "transcribing";

/**
 * Records one spoken answer and returns the transcript via onTranscript.
 * Audio goes to /api/v1/transcribe and is not kept.
 */
export function VoiceRecorder({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-stop at the time limit.
  useEffect(() => {
    if (status === "recording" && seconds >= MAX_SECONDS) stop();
  }, [status, seconds]);

  // Release the microphone (without uploading) if the component unmounts mid-recording.
  useEffect(
    () => () => {
      stopTimer(timerRef);
      const recorder = recorderRef.current;
      if (!recorder) return;
      recorder.onstop = null;
      if (recorder.state === "recording") recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function start() {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't record audio. Type your answer instead.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access was blocked. Allow it in the browser's site settings.");
      return;
    }

    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: BITS_PER_SECOND });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      void upload(new Blob(chunks, { type: recorder.mimeType }));
    };
    recorder.start();
    recorderRef.current = recorder;

    setSeconds(0);
    setStatus("recording");
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stop() {
    stopTimer(timerRef);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
  }

  async function upload(blob: Blob) {
    setStatus("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, "answer");
      const res = await fetch("/api/v1/transcribe", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(ERRORS[body.error] ?? "Transcription failed. Try again or type your answer.");
      onTranscript(body.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "recording" ? (
        <Button variant="danger" onClick={stop}>
          <span className="size-2.5 animate-pulse rounded-sm bg-current" /> Stop ({formatTime(seconds)} /{" "}
          {formatTime(MAX_SECONDS)})
        </Button>
      ) : (
        <Button variant="outline" onClick={start} disabled={status === "transcribing"}>
          <MicIcon className="size-4" />
          {status === "transcribing" ? "Transcribing…" : "Record answer"}
        </Button>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}

const ERRORS: Record<string, string> = {
  unauthorized: "Your session expired. Sign in again.",
  audio_too_large: "The recording is too long. Keep answers under 5 minutes.",
  unsupported_audio_type: "This browser's recording format isn't supported. Type your answer instead.",
};

function stopTimer(ref: { current: ReturnType<typeof setInterval> | null }) {
  if (ref.current) clearInterval(ref.current);
  ref.current = null;
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
