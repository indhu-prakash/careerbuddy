# Seed data sources

`skills.json` and `roles.json` were compiled on 2026-10-31 from public web research.
Topics are paraphrased summaries written for this project, not copied text. Skill
metadata (names, categories, aliases, prerequisites, related skills) was written by
hand. Levels and core/recommended ratings are judgement calls made after
cross-checking at least two sources per role.

Every URL in `skills.json` loaded (HTTP 200) when checked on 2026-10-31.
To re-check them, run `npm run seed:check-links`.

## Role sources

| Role | Sources |
|---|---|
| Frontend, Backend, Full-Stack | roadmap.sh (frontend, backend, full-stack); O*NET 15-1254.00 (Web Developers), 15-1252.00 (Software Developers); Stack Overflow Developer Survey 2025 (technology); jobglance.app frontend role data; seekerscore.com backend engineer market 2026 |
| Mobile Developer | interviewstack.io mobile developer skills 2026 (posting analysis); developer.android.com and developer.apple.com docs (roadmap.sh mobile pages render as images and returned no text) |
| DevOps / Cloud Engineer | Linux Foundation CKA curriculum; devopscube.com DevOps roadmap; AWS Builder Center DevOps roadmap 2026; github.com/milanm/DevOps-Roadmap |
| QA Automation Engineer (SDET) | O*NET 15-1253.00 (Software QA Analysts and Testers); ISTQB CTFL v4.0; qaskills.sh QA-to-SDET roadmap 2026; scrolltest.com QA career roadmap 2026 |
| Cybersecurity Analyst (SOC) | NICE Framework work role "Defensive Cybersecurity" (niccs.cisa.gov); O*NET 15-1212.00 (Information Security Analysts); examos.io SOC analyst roadmap |
| Data Analyst | Microsoft PL-300 study guide (2026); Google Data Analytics certificate; roadmap.sh data-analyst (article text); scaler.com data analyst roadmap |
| Data Engineer | Microsoft DP-700 study guide; Databricks Data Engineer Associate outline; O*NET 15-1243.00; analyticsvidhya.com and datavidhya.com 2026 data engineer roadmaps |
| Data Scientist | O*NET 15-2051.00 (Data Scientists); dataquest.io and 365datascience.com data science roadmaps |
| Machine Learning Engineer | Google Professional ML Engineer exam guide; 365datascience.com ML engineer skills study (1,000 job postings); O*NET 15-2051.00 |
| AI Engineer | kodekloud.com AI engineer roadmap 2026; Anthropic "Building effective agents"; roadmap.sh ai-engineer (role definition only) |
| Product Manager | productplan.com PM skills 2026; product.umd.edu "What is product"; aakashg.com PM role and responsibilities |

## Known limitations

- roadmap.sh renders most role roadmaps client-side, so the fetched pages only
  contributed article text, not the topic graphs.
- Several 2026 "skills report" sources are vendor or education blogs. Treat
  levels as a starting point to tune with real JD data from the app.
- `tensorflow` resource redirects to a locale-specific page and `junit` points at
  `/current/`, which redirects to the newest versioned guide.
