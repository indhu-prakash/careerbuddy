import { requireUser, UnauthorizedError } from "@/lib/auth";
import { audioFormat, MAX_AUDIO_BYTES, transcribeAudio } from "@/lib/ai/transcribe";

export const maxDuration = 120;

// Speech-to-text for voice answers. Body: multipart/form-data with an `audio` file.
// The audio is forwarded to the transcription model and not stored.
export async function POST(request: Request) {
  try {
    await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json({ error: "missing_audio" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "audio_too_large", maxBytes: MAX_AUDIO_BYTES }, { status: 413 });
  }
  const format = audioFormat(audio.type);
  if (!format) {
    return Response.json({ error: "unsupported_audio_type", type: audio.type }, { status: 415 });
  }

  try {
    const transcript = await transcribeAudio(await audio.arrayBuffer(), format);
    return Response.json(transcript);
  } catch (error) {
    console.error("[stt]", error);
    return Response.json({ error: "transcription_failed" }, { status: 502 });
  }
}
