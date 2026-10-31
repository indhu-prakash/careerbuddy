# F7: Application Tracker That Learns

**Status:** Not started (schema ready) · **Stack:** Next.js alone; Python optional much later · **Back to:** [README](README.md)

## Goal

Log job applications and their outcomes. Learn which *kinds* of roles, sources and match-score bands get responses, and turn that into targeting advice.

This module barely uses AI and needs little from the others, so it's a **quick win** that can be built at any point.

## Must-have items

| Item | Notes |
|---|---|
| Add / edit / delete applications | Company, role title, seniority, industry, source (referral / LinkedIn / careers page / recruiter / other), date applied, linked JD, resume version |
| **Match score filled in automatically** | Copied from the F2 analysis for the linked JD and frozen at apply time (not recomputed later) |
| **Role family filled in automatically** | From the matched `RoleTrack.family` (13 seeded templates) |
| Status pipeline | saved → applied → screening → interviewing → offer / rejected / ghosted / withdrawn, each change stored as an `ApplicationEvent` with a timestamp |
| Auto "ghosted" | Cron marks applications with no event after N days (default 21) |
| Board and table views | Kanban by status, sortable table |
| **Response rate per segment** | Role family, seniority, source, industry, match-score band (<50, 50–70, >70) |
| **Smoothing** | Beta prior from the user's overall rate, so 1 of 1 doesn't show as 100% |
| Minimum sample | Show a segment insight only at ≥ 5 applications, always with the count |
| Time to first response | Median per segment |
| Insights and advice | The LLM turns the *computed* stats into 2–3 suggestions, e.g. "referrals respond 3× more often; roles with match below 50% rarely respond" |

## Smoothed rate

```
smoothed = (responses + a) / (applications + a + b)
a = k × overallRate,  b = k × (1 − overallRate),  k ≈ 5
```

## Data and API

- **Tables:** `Application`, `ApplicationEvent`
- `POST /api/v1/applications`, `PATCH /api/v1/applications/:id`, `DELETE /api/v1/applications/:id`
- `POST /api/v1/applications/:id/events`
- `GET /api/v1/applications/insights`
- New lib: `src/lib/scoring/applications.ts`
- **UI:** `/applications`

## LLM vs code

| LLM | Code |
|---|---|
| Advice text from the computed stats | Segments, smoothing, thresholds, ghosting |

## How far "learning" can go

| Stage | What "learns" means | Data needed | Stack |
|---|---|---|---|
| 1. MVP | Smoothed response rates per segment | Any amount | **Next.js + SQL** |
| 2. Enhanced | Per-user logistic "likely to respond" score from a few features | ≥ 50 applications per user | **Next.js** (small TS implementation) |
| 3. Production | A model trained across users (gradient boosting) on anonymized outcomes | Thousands of applications, plus consent | **Python batch job** (scikit-learn / LightGBM), scheduled; results written to Postgres |

> **The only real Python case in the product** is stage 3. Even then it's a scheduled training job, not a FastAPI backend behind every request, and it needs real usage data first.

## Optional later

- Gmail integration to detect replies automatically (OAuth; needs a privacy review).

## Done when

- Applications can be logged and moved through statuses, with full history.
- The insights page shows smoothed rates per segment with counts, and hides segments under 5 applications.
- Match score and role family are filled in when a JD from F2 is linked.
