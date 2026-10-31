# AGENTS.md

<!-- handoff:learnings:begin -->
## Session Learnings (auto-updated by handoff)

### Implicit Rules
- Prod URL https://careerbuddy-ecru.vercel.app; Vercel scope indhu-prakashs-projects, project careerbuddy, hobby plan
- GitHub repo indhu-prakash/careerbuddy; push to main auto-deploys production
- Vercel env values stored as Secret type — vercel env pull shows [SENSITIVE]; overwrite by rm + add
- NEXT_PUBLIC_* baked at build — env change needs redeploy without build cache
- Supabase built-in mailer: 2 emails/hour, team members only
- Optional env with code defaults: AI_TOTAL_BUDGET_MS (270000), AI_JSON_MODE_MODELS, AI_MODEL_TRANSCRIBE(_FALLBACK)

### Key Decisions
- Decision: NEXT_PUBLIC_SITE_URL=https://careerbuddy-ecru.vercel.app for Production and Preview — Reason: magic link emailRedirectTo built from it; preview links landing on prod still work
- Decision: login action logs Supabase error and maps 429/over_email_send_rate_limit→rate_limited, email_address_not_authorized→not_authorized — Reason: generic 'try again in a minute' hid real cause (hourly limit)
- Decision: ERROR_MESSAGES lookup guarded by Object.hasOwn — Reason: query param keys like 'constructor' would render prototype functions
- Decision: random CRON_SECRET in Vercel production only — Reason: cron routes require Bearer token; Vercel sends it automatically
- Decision: AI_MODEL_FALLBACK=dots-studio/dots-3-note-preview:free in .env and Vercel — Reason: match updated .env.example; Gemma is JSON-mode-only and now built-in last-resort fallback
- Decision: deploy via git push to main, not CLI — Reason: Vercel project connected to indhu-prakash/careerbuddy; keeps GitHub and prod in sync

<!-- handoff:learnings:end -->
