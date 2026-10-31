# F5: Mock Interviews Scored Against a Rubric

**Status:** Partial · **Stack:** Next.js alone · **Back to:** [README](README.md)

## Goal

Questions based on the target role and the user's gaps. The user answers by text or voice and gets a per-criterion rubric score, feedback and a model answer. The overall score is computed in code, and the scores feed skill levels in F6.

## How it works today

- `/interview/practice` with 3 hard-coded sample questions (technical, behavioral, system design).
- Voice: `VoiceRecorder` → `POST /api/v1/transcribe` (OpenRouter Voxtral → Whisper fallback). The user can edit the transcript.
- Scoring: `POST /api/v1/interview/score` → `evaluateAnswer` → LLM rates each criterion 1–5 → [scoring/interview.ts](../../src/lib/scoring/interview.ts) computes the overall 0–100.
- Nothing is saved; audio is never stored.

## Must-have items

| Item | Status |
|---|---|
| Rubric per question type (`DEFAULT_RUBRICS`) | Done |
| AI scoring per criterion, plus feedback and a model answer | Done |
| Overall score computed in code | Done (tested) |
| Voice recording + transcription | Done; **untested live** (see blocker) |
| Practice page with results | Done |
| **Question generation** from the target role and top gaps: mix of technical, behavioral, system design and scenario questions, each tied to a `skillId` | Missing (3 hard-coded samples) |
| **Saved sessions**: `InterviewSession`, `InterviewQuestion`, `InterviewEvaluation`, giving history and a session score | Missing |
| **Send the target role from the UI.** The API accepts `targetRole` but `PracticeInterview` never sends it. | Missing |
| **Show the rubric before answering** | Missing |
| Follow-up question when a criterion scores ≤ 2 (`InterviewQuestion.parentId`) | Missing |
| Session report: recurring weaknesses, missing concepts, next steps (`InterviewSession.summary`) | Missing |
| Feed scores to F6 (`ProgressEvent(kind = interview_scored)` with `skillId`) | Missing |
| Background scoring: score each answer as soon as it's submitted, so the user isn't waiting ~50 s × N at the end | Missing |

## Blocker

OpenRouter returns **HTTP 402** for audio until the account has at least $0.50 of balance. There is no free speech-to-text. Adding $10 also raises the free LLM limit from 50 to 1,000 requests/day. After that, test Chrome (WebM) and iPhone Safari (MP4) over HTTPS.

## Data and API

- **Tables:** `InterviewSession`, `InterviewQuestion`, `InterviewEvaluation`
- `POST /api/v1/transcribe` (exists)
- `POST /api/v1/interview/score` (exists, stateless; keep it for practice mode)
- `POST /api/v1/interviews` `{ targetRoleId, kind, count }` → create a session and generate questions
- `POST /api/v1/interviews/:id/answers` `{ questionId, answer }` → score and save the evaluation
- `POST /api/v1/interviews/:id/complete` → session summary

## LLM vs code

| LLM | Code |
|---|---|
| Question generation, per-criterion scores and comments, model answer, session summary | Rubric selection, overall score, follow-up trigger, skill-level events |

## Stack assessment

| Need | Next.js | Python alternative | Verdict |
|---|---|---|---|
| Speech-to-text | OpenRouter STT (built) | Self-hosted Whisper on a GPU | The API is cheaper and simpler |
| Audio > 4 MB | Signed upload to Storage → transcribe → delete | Same limit | JS |
| Running code for coding questions | External sandbox API (Judge0 / Piston / E2B) | Building your own Python sandbox is unsafe | External API |
| Real-time voice interviewer | WebRTC + a realtime voice API | Not needed | Future |

## Done when

- A session generates role- and gap-specific questions (no sample questions), saves every answer and evaluation, and shows a session score and summary.
- Interview scores appear as progress events against the right skill.
- Real transcription verified on desktop Chrome and iPhone Safari.
