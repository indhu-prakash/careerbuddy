# CLAUDE.md

<!-- handoff:learnings:begin -->
## Session Learnings (auto-updated by handoff)

### Implicit Rules
- Env: OPENROUTER_API_KEY shared by LLM and STT; AI_MODEL_TRANSCRIBE / AI_MODEL_TRANSCRIBE_FALLBACK override STT models
- Feature code under src/features/<module>/components; API under src/app/api/v1; deterministic scoring under src/lib/scoring
- Route handlers: requireUser() then UnauthorizedError → 401 JSON; upstream AI failure → 502 JSON error code
- Mic requires HTTPS or localhost; test phones via Vercel or tunnel
- Free Nemotron scoring latency ~50s; routes set maxDuration 120

### Key Decisions
- Decision: Next.js full-stack, not FastAPI — Reason: one deployable, one language, shared Zod schemas, Vercel no cold start; Python only later as single service if needed
- Decision: OpenRouter transcription, Voxtral Mini primary (mistralai/voxtral-mini-transcribe), openai/whisper-large-v3 fallback — Reason: same API key/billing as LLM calls, ~$0.003/min
- Decision: JSON body with base64 input_audio + format — Reason: documented OpenRouter shape; multipart also accepted but JSON matches existing client style
- Decision: audio never stored — Reason: ARCHITECTURE.md privacy rule
- Decision: upload cap 4 MB, recorder 32 kbps, 5 min max — Reason: Vercel 4.5 MB request body limit
- Decision: separate transcribe and score endpoints — Reason: user can correct transcript before scoring; avoids wasted LLM calls
- Decision: overall score computed in code (src/lib/scoring/interview.ts): rubric order, missing criterion = 1, clamp 1-5, map to 0-100 — Reason: LLM can't inflate by skipping/renaming criteria; testable
- Decision: score endpoint stateless for now — Reason: no question generation/sessions yet; evaluateAnswer reusable when persisting InterviewQuestion

<!-- handoff:learnings:end -->
