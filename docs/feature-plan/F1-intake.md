# F1: Resume and Target-Role Intake

**Status:** Partial · **Stack:** Next.js alone · **Back to:** [README](README.md)

## Goal

Turn a resume and a few answers into a structured profile that every later module reads, so the raw documents never have to be parsed again.

## How it works today

- The user uploads a resume (PDF, DOCX or TXT) or pastes the text on `/analyze`.
- It is parsed in memory ([extract-text.ts](../../src/lib/analysis/extract-text.ts): `pdf-parse`, `mammoth`) and never stored.
- The AI returns only `currentRole`, `yearsExperience` and `summary`, as part of the F2 call.

## Must-have items

| Item | Status |
|---|---|
| Resume upload (PDF, DOCX, TXT or paste), with size and type checks | Done |
| Text extraction | Done |
| **Target-role input**: title, seniority, industry, location | Missing |
| **Hours per week and timeline** (4/8/12/16 weeks or a target date). The `User.hoursPerWeek` and `User.targetDate` columns exist but nothing sets them. F3 can't plan without these. | Missing |
| **Structured resume extraction**: skills with evidence quotes, experience entries, education, projects | Missing (summary only) |
| Server-side check that every evidence quote appears in the resume text | Missing |
| Skill names normalized to the catalog (`Skill.aliases`, [normalize.ts](../../src/lib/skills/normalize.ts)) | Missing |
| **Review step**: the user confirms, edits or removes parsed skills (`UserSkill.confirmedByUser`) | Missing |
| Target title linked to one of the **13 seeded role templates** (`RoleTrack.aliases`), with a manual picker when there's no match | Missing |
| **Save** `Resume`, `UserSkill`, `TargetRole`, and the onboarding fields on `User` | Missing |
| Store the resume file in the private `resumes` bucket. The helpers in [storage.ts](../../src/lib/storage.ts) are written but never called. | Missing |
| Dedupe by `Resume.sha256` so the same resume is never parsed twice | Missing |
| Scanned / image-only PDFs: fall back to the vision-capable model when extraction returns almost no text | Missing |

## Data and API

- **Tables:** `User`, `Resume`, `UserSkill`, `TargetRole`, `RoleTrack`
- `POST /api/v1/resumes`: upload, extract text, store the file, run structured extraction, save the rows
- `PATCH /api/v1/resumes/:id/skills`: user corrections
- `POST /api/v1/target-roles`, `PATCH /api/v1/me` (hours/week, target date)
- **UI:** `/onboarding` as a 3-step wizard: resume → review skills → target role and time budget

## LLM vs code

| LLM | Code |
|---|---|
| Structured extraction with verbatim quotes | Quote check, alias normalization, role-template matching, dedupe, persistence |

## Stack assessment

| Need | Next.js | Python alternative | Verdict |
|---|---|---|---|
| PDF/DOCX text | `pdf-parse`, `mammoth` (installed) | PyMuPDF, python-docx | JS is enough |
| Scanned PDFs | Page images → vision LLM | Tesseract / PaddleOCR | JS + LLM |
| Two-column layouts | The LLM restructures the extracted text | PyMuPDF layout blocks | JS is enough |

> **Limit:** Vercel caps request bodies at 4.5 MB. If larger files show up, upload straight to Supabase Storage with a signed upload URL and send only the path to the API.

## Done when

- A new user can finish onboarding and the database has `Resume`, `UserSkill` (with quotes), an active `TargetRole` linked to a `RoleTrack`, and `hoursPerWeek` and `targetDate` set.
- Uploading the same resume twice doesn't call the LLM again.
- Every saved skill quote appears verbatim in the resume text.

## Privacy

Free OpenRouter models may log prompts. Use only test resumes until a paid model that doesn't log prompts is configured (ARCHITECTURE.md §4.4).
