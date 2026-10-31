# F4: Portfolio Project Suggestions

**Status:** Not started (schema ready) · **Stack:** Next.js alone · **Back to:** [README](README.md)

## Goal

2–4 projects that together cover the biggest gaps. Each one is buildable within the plan and gives the user something concrete to talk about in interviews.

## Depends on

- [F2](F2-skill-gap-map.md): saved gap items
- [F3](F3-learning-plan.md): plan weeks, for fitting milestones. Build F3 and F4 together, since they read the same gap data.

## Must-have items

| Item | Notes |
|---|---|
| **Prompt for candidate projects** | The LLM proposes 6–8 ideas, each tagged with catalog skills it demonstrates, a tier, scope, milestones and interview talking points |
| **Code selection**: greedy weighted set cover (`src/lib/scoring/coverage.ts`) | Each round, pick the candidate covering the most remaining gap weight, until 2–4 projects or the top gaps are covered |
| **Coverage check** | The chosen projects must cover the top gaps; show any that aren't covered |
| Fit to time | Milestones are placed as `PlanTask(kind = project_milestone)` in the plan's weeks |
| Per-project detail | Problem statement, skills, scope, milestones, architecture sketch, testing and deployment, deliverables (`PortfolioProject.spec`) |
| Talking points | STAR-style "how to talk about it" (`talkingPoints`) |
| Status tracking | suggested → in_progress → done / dropped, plus `repoUrl` |
| UI | Project cards and a coverage view (which gaps each project closes) |

## Data and API

- **Table:** `PortfolioProject`
- `POST /api/v1/projects/suggest` `{ gapAnalysisId, planId? }`
- `PATCH /api/v1/projects/:id`
- **UI:** `/projects`

## LLM vs code

| LLM | Code |
|---|---|
| Project ideas, specs, talking points | Skill tags validated against the catalog, selection, coverage check, fitting milestones into the plan |

## Optional later

- Check the repo through the GitHub REST API (README, languages, commit activity) to confirm the claimed skills appear in the code. Plain `fetch` from TypeScript.

## Stack assessment

Set cover over fewer than 10 candidates is a few lines of TypeScript. **No Python needed.**

## Done when

- 2–4 projects are saved, each with at least 2 gap skills.
- The coverage view shows every top-5 gap as covered, or explicitly not covered.
- Milestones appear in the learning plan.
