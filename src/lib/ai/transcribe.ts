import "server-only";

// Speech-to-text through OpenRouter's transcription endpoint (same key as the LLM calls).
// Audio is sent once and never stored (ARCHITECTURE.md §12.2: audio not retained).
export const TRANSCRIBE_PRIMARY = process.env.AI_MODEL_TRANSCRIBE ?? "mistralai/voxtral-mini-transcribe";
export const TRANSCRIBE_FALLBACK = process.env.AI_MODEL_TRANSCRIBE_FALLBACK ?? "openai/whisper-large-v3";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/audio/transcriptions";
// The upstream provider times out at 60 s; leave headroom for the upload.
const TIMEOUT_MS = 90_000;

// Vercel rejects request bodies over 4.5 MB, so keep uploads below that.
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

// Browser MediaRecorder MIME types → OpenRouter `input_audio.format`.
// Chrome/Firefox/Edge record audio/webm (Opus); Safari records audio/mp4 (AAC).
const FORMATS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/aac": "aac",
  "audio/flac": "flac",
};

/** OpenRouter audio format for a MIME type such as "audio/webm;codecs=opus", or null if unsupported. */
export function audioFormat(mimeType: string): string | null {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  return FORMATS[base] ?? null;
}

export type Transcript = { text: string; seconds: number | null; model: string };

/**
 * Transcribe one recording. Tries the primary model, then the fallback;
 * throws if neither returns text.
 */
export async function transcribeAudio(audio: ArrayBuffer, format: string, language?: string): Promise<Transcript> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set.");

  const data = Buffer.from(audio).toString("base64");
  const errors: string[] = [];
  for (const model of [TRANSCRIBE_PRIMARY, TRANSCRIBE_FALLBACK]) {
    try {
      return await callTranscription({ apiKey, model, data, format, language });
    } catch (err) {
      const message = `${model}: ${err instanceof Error ? err.message : String(err)}`;
      console.warn(`[stt] ${message}`);
      errors.push(message);
    }
  }
  throw new Error(`All transcription models failed.\n${errors.join("\n")}`);
}

async function callTranscription(opts: {
  apiKey: string;
  model: string;
  data: string;
  format: string;
  language?: string;
}): Promise<Transcript> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Career Pivot Coach",
    },
    body: JSON.stringify({
      model: opts.model,
      input_audio: { data: opts.data, format: opts.format },
      ...(opts.language ? { language: opts.language } : {}),
      temperature: 0,
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  if (body.error) throw new Error(body.error.message ?? JSON.stringify(body.error));

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) throw new Error("Model returned no text.");
  return { text, seconds: body.usage?.seconds ?? null, model: opts.model };
}
