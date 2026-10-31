# CareerBuddy: Database Design

> Generated from [prisma/schema.prisma](../prisma/schema.prisma) by `npm run docs:db`. Don't edit by hand.

Supabase Postgres, accessed only from the server through Prisma 7. **26 tables**, **21 enums**.

- **Ownership:** every user-owned table carries `userId`, and every query is scoped to the signed-in user. Deleting a user cascades to all of their rows, and the `users` row itself cascades from Supabase's `auth.users`.
- **Row Level Security:** enabled on every table with no policies, so Supabase's public Data API can't read or write anything.
- **JSON columns** (`Json`) are JSONB, validated with Zod on write and read. They hold AI output that is always read as a whole (resume profile, week content, project specs, rubric scores).
- **Keys:** UUID primary keys. `users.id` equals the Supabase auth user id.

Notation (UML crow's foot): `||` exactly one, `|o` zero or one, `o{` zero or many. **PK** primary key, **FK** foreign key, **UK** unique.

## 1. Entity-relationship overview

All tables and relationships (attributes in §2).

```mermaid
erDiagram
  User ||--o{ Resume : "user"
  User ||--o{ UserSkill : "user"
  Skill ||--o{ UserSkill : "skill"
  Resume |o--o{ UserSkill : "sourceResume"
  User ||--o{ TargetRole : "user"
  RoleTrack |o--o{ TargetRole : "roleTrack"
  User ||--o{ JobDescription : "user"
  TargetRole |o--o{ JobDescription : "targetRole"
  JobDescription ||--o{ JobRequirement : "jobDescription"
  User ||--o{ JobRequirement : "user"
  Skill |o--o{ JobRequirement : "skill"
  Skill ||--o{ SkillTopic : "skill"
  Skill ||--o{ SkillEdge : "from"
  Skill ||--o{ SkillEdge : "to"
  Skill ||--o{ LearningResource : "skill"
  RoleTrack ||--o{ RoleTrackSkill : "track"
  Skill ||--o{ RoleTrackSkill : "skill"
  User ||--o{ GapAnalysis : "user"
  TargetRole |o--o{ GapAnalysis : "targetRole"
  Resume ||--o{ GapAnalysis : "resume"
  GapAnalysis ||--o{ GapAnalysisJob : "analysis"
  JobDescription ||--o{ GapAnalysisJob : "jobDescription"
  GapAnalysis ||--o{ GapItem : "analysis"
  Skill |o--o{ GapItem : "skill"
  User ||--o{ LearningPlan : "user"
  GapAnalysis ||--o{ LearningPlan : "gapAnalysis"
  LearningPlan |o--o{ LearningPlan : "parent"
  LearningPlan ||--o{ PlanWeek : "plan"
  PlanWeek ||--o{ PlanTask : "week"
  User ||--o{ PlanTask : "user"
  Skill |o--o{ PlanTask : "skill"
  LearningResource |o--o{ PlanTask : "resource"
  User ||--o{ PortfolioProject : "user"
  GapAnalysis |o--o{ PortfolioProject : "gapAnalysis"
  LearningPlan |o--o{ PortfolioProject : "plan"
  User ||--o{ InterviewSession : "user"
  TargetRole |o--o{ InterviewSession : "targetRole"
  InterviewSession ||--o{ InterviewQuestion : "session"
  User ||--o{ InterviewQuestion : "user"
  InterviewQuestion |o--o{ InterviewQuestion : "parent"
  Skill |o--o{ InterviewQuestion : "skill"
  InterviewQuestion ||--o| InterviewEvaluation : "question"
  User ||--o{ InterviewEvaluation : "user"
  User ||--o{ ProgressEvent : "user"
  PlanTask |o--o{ ProgressEvent : "task"
  Skill |o--o{ ProgressEvent : "skill"
  User ||--o{ Application : "user"
  JobDescription |o--o{ Application : "jobDescription"
  Resume |o--o{ Application : "resume"
  Application ||--o{ ApplicationEvent : "application"
  User ||--o{ ApplicationEvent : "user"
  User |o--o{ AiCall : "user"
```

## 2. Diagrams by module

### Users & intake (F1)

Profile, resumes, the skills inventory and target roles.

```mermaid
erDiagram
  User {
    String id PK
    String email UK "nullable"
    String name "nullable"
    String currentRole "nullable"
    Float yearsExperience "nullable"
    String location "nullable"
    String industry "nullable"
    String salaryExpectation "nullable, free text, e.g. '₹18-24 LPA'"
    String careerGoal "nullable"
    Int hoursPerWeek
    DateTime targetDate "nullable"
    DateTime onboardedAt "nullable"
    DateTime createdAt
  }
  Resume {
    String id PK
    String userId FK
    String storagePath "nullable, object key in the private 'resumes' bucket: {userId}/{resume"
    String fileName "nullable"
    String mimeType "nullable"
    String sha256 "nullable, hash of the extracted text, for dedupe and AI result caching"
    String rawText
    Json parsed "nullable, extracted profile (role, experience, summary)"
    ResumeStatus status
    String parseError "nullable"
    Boolean isPrimary
    DateTime createdAt
  }
  UserSkill {
    String id PK
    String userId FK
    String skillId FK
    Int level
    EvidenceType evidenceType
    Json evidence "[{ source, refId, quote }]"
    Float confidence "nullable"
    Boolean confirmedByUser
    String sourceResumeId FK "nullable"
    DateTime createdAt
    DateTime updatedAt
  }
  TargetRole {
    String id PK
    String userId FK
    String roleTrackId FK "nullable, matched taxonomy role, if any"
    String title
    String seniority "nullable"
    String industry "nullable"
    String location "nullable"
    String salaryExpectation "nullable"
    Int hoursPerWeek "nullable"
    Int horizonWeeks "nullable, 4 / 8 / 12 / 16"
    String notes "nullable"
    Boolean isActive
    DateTime createdAt
  }
  RoleTrack {
    String id PK
    String slug UK
    String title
    String family "engineering / data / ai / quality / security / product"
    String[] aliases "job titles that map to this track, lowercased"
    String description
  }
  Skill {
    String id PK
    String slug UK
    String name UK "canonical name"
    String[] aliases "lowercased; see src/lib/skills/normalize.ts"
    String category "nullable, language / framework / cloud / tool / concept / domain / sof"
    String description "nullable"
    Boolean curated
  }
  User ||--o{ Resume : "user"
  User ||--o{ UserSkill : "user"
  Skill ||--o{ UserSkill : "skill"
  Resume |o--o{ UserSkill : "sourceResume"
  User ||--o{ TargetRole : "user"
  RoleTrack |o--o{ TargetRole : "roleTrack"
```

### Skill taxonomy (shared, seeded)

Canonical skills with aliases, prerequisites, topics, curated resources and role templates.

```mermaid
erDiagram
  Skill {
    String id PK
    String slug UK
    String name UK "canonical name"
    String[] aliases "lowercased; see src/lib/skills/normalize.ts"
    String category "nullable, language / framework / cloud / tool / concept / domain / sof"
    String description "nullable"
    Boolean curated
  }
  SkillTopic {
    String id PK
    String skillId FK
    SkillTier tier
    Int position
    String title
  }
  SkillEdge {
    String fromSkillId PK, FK
    String toSkillId PK, FK
    EdgeKind kind PK
    Float weight
  }
  LearningResource {
    String id PK
    String skillId FK
    String title
    String url
    String kind "docs / tutorial / course / book / guide"
    SkillTier tier
    Boolean curated
  }
  RoleTrack {
    String id PK
    String slug UK
    String title
    String family "engineering / data / ai / quality / security / product"
    String[] aliases "job titles that map to this track, lowercased"
    String description
  }
  RoleTrackSkill {
    String trackId PK, FK
    String skillId PK, FK
    SkillTier tier
    Int requiredLevel "1..4, job-ready level for this role"
    RoleSkillImportance importance
    String choiceGroup "nullable, skills sharing a group are alternatives: knowing one satisfi"
  }
  Skill ||--o{ SkillTopic : "skill"
  Skill ||--o{ SkillEdge : "from"
  Skill ||--o{ SkillEdge : "to"
  Skill ||--o{ LearningResource : "skill"
  RoleTrack ||--o{ RoleTrackSkill : "track"
  Skill ||--o{ RoleTrackSkill : "skill"
```

### Job descriptions & gap map (F2)

JDs, extracted requirements and the saved gap matrix.

```mermaid
erDiagram
  User {
    String id PK
    String email UK "nullable"
    String name "nullable"
    String currentRole "nullable"
    Float yearsExperience "nullable"
    String location "nullable"
    String industry "nullable"
    String salaryExpectation "nullable, free text, e.g. '₹18-24 LPA'"
    String careerGoal "nullable"
    Int hoursPerWeek
    DateTime targetDate "nullable"
    DateTime onboardedAt "nullable"
    DateTime createdAt
  }
  Resume {
    String id PK
    String userId FK
    String storagePath "nullable, object key in the private 'resumes' bucket: {userId}/{resume"
    String fileName "nullable"
    String mimeType "nullable"
    String sha256 "nullable, hash of the extracted text, for dedupe and AI result caching"
    String rawText
    Json parsed "nullable, extracted profile (role, experience, summary)"
    ResumeStatus status
    String parseError "nullable"
    Boolean isPrimary
    DateTime createdAt
  }
  TargetRole {
    String id PK
    String userId FK
    String roleTrackId FK "nullable, matched taxonomy role, if any"
    String title
    String seniority "nullable"
    String industry "nullable"
    String location "nullable"
    String salaryExpectation "nullable"
    Int hoursPerWeek "nullable"
    Int horizonWeeks "nullable, 4 / 8 / 12 / 16"
    String notes "nullable"
    Boolean isActive
    DateTime createdAt
  }
  JobDescription {
    String id PK
    String userId FK
    String targetRoleId FK "nullable"
    JdSource source
    String company "nullable"
    String title "nullable"
    String url "nullable"
    String rawText
    String contentHash "nullable, dedupe identical JDs per user"
    Json parsed "nullable, extracted skills as returned by the model"
    DateTime createdAt
  }
  JobRequirement {
    String id PK
    String jobDescriptionId FK
    String userId FK
    String skillId FK "nullable"
    String skillName "as extracted (canonical display name)"
    RequirementKind kind
    RequirementCategory category "nullable"
    Int requiredLevel "nullable, 1..4"
    Float minYears "nullable"
    String evidenceQuote "nullable, verbatim quote from the JD"
  }
  GapAnalysis {
    String id PK
    String userId FK
    String targetRoleId FK "nullable"
    String resumeId FK
    Float matchScore
    Int jdCount
    Json candidate "nullable, { currentRole, yearsExperience, summary }"
    Json recommendations
    String model "nullable, model that produced the extraction"
    String promptVersion "nullable"
    DateTime createdAt
  }
  GapAnalysisJob {
    String analysisId PK, FK
    String jobDescriptionId PK, FK
  }
  GapItem {
    String id PK
    String analysisId FK
    String skillId FK "nullable"
    String skillName
    Int position "rank by gap, 0 = biggest"
    Float demand "0..1, weighted share of JDs asking for it"
    Float have "0 / 0.5 / 1, evidence in the resume"
    Float gap "demand * (1 - have)"
    GapStatus status
    Int currentLevel "nullable"
    Int requiredLevel "nullable"
    Float priority "nullable"
    RequirementCategory category "nullable"
    Float effortHours "nullable, estimated hours to close the gap (from catalog tier/levels)"
    Boolean fromTemplate "demand comes from the role template, not JDs"
    String evidence "nullable, verbatim resume quote"
  }
  Skill {
    String id PK
    String slug UK
    String name UK "canonical name"
    String[] aliases "lowercased; see src/lib/skills/normalize.ts"
    String category "nullable, language / framework / cloud / tool / concept / domain / sof"
    String description "nullable"
    Boolean curated
  }
  User ||--o{ Resume : "user"
  User ||--o{ TargetRole : "user"
  User ||--o{ JobDescription : "user"
  TargetRole |o--o{ JobDescription : "targetRole"
  JobDescription ||--o{ JobRequirement : "jobDescription"
  User ||--o{ JobRequirement : "user"
  Skill |o--o{ JobRequirement : "skill"
  User ||--o{ GapAnalysis : "user"
  TargetRole |o--o{ GapAnalysis : "targetRole"
  Resume ||--o{ GapAnalysis : "resume"
  GapAnalysis ||--o{ GapAnalysisJob : "analysis"
  JobDescription ||--o{ GapAnalysisJob : "jobDescription"
  GapAnalysis ||--o{ GapItem : "analysis"
  Skill |o--o{ GapItem : "skill"
```

### Learning plan & projects (F3, F4)

Versioned plans, weeks, tasks and portfolio projects.

```mermaid
erDiagram
  GapAnalysis {
    String id PK
    String userId FK
    String targetRoleId FK "nullable"
    String resumeId FK
    Float matchScore
    Int jdCount
    Json candidate "nullable, { currentRole, yearsExperience, summary }"
    Json recommendations
    String model "nullable, model that produced the extraction"
    String promptVersion "nullable"
    DateTime createdAt
  }
  LearningPlan {
    String id PK
    String userId FK
    String gapAnalysisId FK
    String parentId FK "nullable"
    Int version
    PlanStatus status
    Int durationWeeks "4 / 8 / 12 / 16"
    Int hoursPerWeek
    String reason "nullable, why this version was generated (replan trigger)"
    Json changeSummary "nullable, what changed vs the parent version"
    DateTime startDate
    DateTime createdAt
  }
  PlanWeek {
    String id PK
    String planId FK
    Int weekNumber
    String goal
    Json objectives
    Json content "nullable, concepts, exercises, assignments, resources, outcomes, asses"
    String checkpoint "nullable"
    DateTime startDate "nullable"
  }
  PlanTask {
    String id PK
    String weekId FK
    String userId FK
    String skillId FK "nullable"
    String resourceId FK "nullable, curated resource, if any"
    TaskKind kind
    Int position
    String title
    String resourceUrl "nullable, AI-suggested link when no curated resource exists"
    Float estHours
    Float hoursSpent
    TaskStatus status
    Float score "nullable, 0..1, for assessments"
    DateTime dueDate "nullable"
    DateTime completedAt "nullable"
  }
  LearningResource {
    String id PK
    String skillId FK
    String title
    String url
    String kind "docs / tutorial / course / book / guide"
    SkillTier tier
    Boolean curated
  }
  PortfolioProject {
    String id PK
    String userId FK
    String gapAnalysisId FK "nullable"
    String planId FK "nullable"
    ProjectTier tier
    String title
    String description "problem statement"
    Json spec "nullable, requirements, architecture, schema, APIs, milestones, testin"
    Json skills "skill names the project demonstrates"
    String talkingPoints "nullable"
    ProjectStatus status
    String repoUrl "nullable"
    DateTime createdAt
  }
  Skill {
    String id PK
    String slug UK
    String name UK "canonical name"
    String[] aliases "lowercased; see src/lib/skills/normalize.ts"
    String category "nullable, language / framework / cloud / tool / concept / domain / sof"
    String description "nullable"
    Boolean curated
  }
  Skill ||--o{ LearningResource : "skill"
  GapAnalysis ||--o{ LearningPlan : "gapAnalysis"
  LearningPlan |o--o{ LearningPlan : "parent"
  LearningPlan ||--o{ PlanWeek : "plan"
  PlanWeek ||--o{ PlanTask : "week"
  Skill |o--o{ PlanTask : "skill"
  LearningResource |o--o{ PlanTask : "resource"
  GapAnalysis |o--o{ PortfolioProject : "gapAnalysis"
  LearningPlan |o--o{ PortfolioProject : "plan"
```

### Mock interviews (F5)

Sessions, questions (with follow-ups) and evaluations.

```mermaid
erDiagram
  User {
    String id PK
    String email UK "nullable"
    String name "nullable"
    String currentRole "nullable"
    Float yearsExperience "nullable"
    String location "nullable"
    String industry "nullable"
    String salaryExpectation "nullable, free text, e.g. '₹18-24 LPA'"
    String careerGoal "nullable"
    Int hoursPerWeek
    DateTime targetDate "nullable"
    DateTime onboardedAt "nullable"
    DateTime createdAt
  }
  TargetRole {
    String id PK
    String userId FK
    String roleTrackId FK "nullable, matched taxonomy role, if any"
    String title
    String seniority "nullable"
    String industry "nullable"
    String location "nullable"
    String salaryExpectation "nullable"
    Int hoursPerWeek "nullable"
    Int horizonWeeks "nullable, 4 / 8 / 12 / 16"
    String notes "nullable"
    Boolean isActive
    DateTime createdAt
  }
  InterviewSession {
    String id PK
    String userId FK
    String targetRoleId FK "nullable"
    String targetRoleTitle "nullable, for practice without a saved target role"
    InterviewKind kind
    InterviewStatus status
    String rubricVersion "nullable"
    Float overallScore "nullable"
    Json summary "nullable, session report: recurring weaknesses, next steps"
    DateTime createdAt
    DateTime completedAt "nullable"
  }
  InterviewQuestion {
    String id PK
    String sessionId FK
    String userId FK
    String parentId FK "nullable, set for follow-up questions"
    String skillId FK "nullable"
    Int seq
    QuestionType type
    String question
    Json rubric "[{ criterion, description, weight? }]"
    String answer "nullable"
    DateTime answeredAt "nullable"
  }
  InterviewEvaluation {
    String id PK
    String questionId FK, UK
    String userId FK
    Float overallScore "computed in code from the criterion scores"
    Json criteria "[{ criterion, score 1-5, comment }]"
    Json strengths
    Json improvements
    Json missingConcepts
    String modelAnswer "nullable"
    String model "nullable"
    String promptVersion "nullable"
    DateTime createdAt
  }
  Skill {
    String id PK
    String slug UK
    String name UK "canonical name"
    String[] aliases "lowercased; see src/lib/skills/normalize.ts"
    String category "nullable, language / framework / cloud / tool / concept / domain / sof"
    String description "nullable"
    Boolean curated
  }
  User ||--o{ TargetRole : "user"
  User ||--o{ InterviewSession : "user"
  TargetRole |o--o{ InterviewSession : "targetRole"
  InterviewSession ||--o{ InterviewQuestion : "session"
  User ||--o{ InterviewQuestion : "user"
  InterviewQuestion |o--o{ InterviewQuestion : "parent"
  Skill |o--o{ InterviewQuestion : "skill"
  InterviewQuestion ||--o| InterviewEvaluation : "question"
  User ||--o{ InterviewEvaluation : "user"
```

### Progress & applications (F6, F7)

Append-only progress log, the application tracker and its event history.

```mermaid
erDiagram
  User {
    String id PK
    String email UK "nullable"
    String name "nullable"
    String currentRole "nullable"
    Float yearsExperience "nullable"
    String location "nullable"
    String industry "nullable"
    String salaryExpectation "nullable, free text, e.g. '₹18-24 LPA'"
    String careerGoal "nullable"
    Int hoursPerWeek
    DateTime targetDate "nullable"
    DateTime onboardedAt "nullable"
    DateTime createdAt
  }
  PlanTask {
    String id PK
    String weekId FK
    String userId FK
    String skillId FK "nullable"
    String resourceId FK "nullable, curated resource, if any"
    TaskKind kind
    Int position
    String title
    String resourceUrl "nullable, AI-suggested link when no curated resource exists"
    Float estHours
    Float hoursSpent
    TaskStatus status
    Float score "nullable, 0..1, for assessments"
    DateTime dueDate "nullable"
    DateTime completedAt "nullable"
  }
  ProgressEvent {
    String id PK
    String userId FK
    ProgressKind kind
    String taskId FK "nullable"
    String skillId FK "nullable"
    String refId "nullable, e.g. interview question or plan id"
    Float hours "nullable"
    Float value "nullable, score 0..1, or self-rating 1-5"
    String note "nullable"
    Json meta "nullable"
    DateTime occurredAt
  }
  Application {
    String id PK
    String userId FK
    String jobDescriptionId FK "nullable"
    String resumeId FK "nullable, resume version used"
    String company
    String roleTitle
    String roleFamily "nullable, e.g. 'data engineering'"
    String seniority "nullable"
    String industry "nullable"
    String companySize "nullable, startup / mid / enterprise"
    String location "nullable"
    ApplicationSource source "nullable"
    Boolean referral
    Boolean tailored
    Float matchScore "nullable, gap-analysis match score at the time of applying"
    ApplicationStatus status
    DateTime appliedAt
    DateTime respondedAt "nullable"
    DateTime followUpAt "nullable"
    String notes "nullable"
  }
  ApplicationEvent {
    String id PK
    String applicationId FK
    String userId FK
    ApplicationStatus stage
    String rejectionReason "nullable"
    String feedback "nullable"
    String notes "nullable"
    DateTime occurredAt
  }
  JobDescription {
    String id PK
    String userId FK
    String targetRoleId FK "nullable"
    JdSource source
    String company "nullable"
    String title "nullable"
    String url "nullable"
    String rawText
    String contentHash "nullable, dedupe identical JDs per user"
    Json parsed "nullable, extracted skills as returned by the model"
    DateTime createdAt
  }
  Resume {
    String id PK
    String userId FK
    String storagePath "nullable, object key in the private 'resumes' bucket: {userId}/{resume"
    String fileName "nullable"
    String mimeType "nullable"
    String sha256 "nullable, hash of the extracted text, for dedupe and AI result caching"
    String rawText
    Json parsed "nullable, extracted profile (role, experience, summary)"
    ResumeStatus status
    String parseError "nullable"
    Boolean isPrimary
    DateTime createdAt
  }
  Skill {
    String id PK
    String slug UK
    String name UK "canonical name"
    String[] aliases "lowercased; see src/lib/skills/normalize.ts"
    String category "nullable, language / framework / cloud / tool / concept / domain / sof"
    String description "nullable"
    Boolean curated
  }
  User ||--o{ Resume : "user"
  User ||--o{ JobDescription : "user"
  User ||--o{ PlanTask : "user"
  Skill |o--o{ PlanTask : "skill"
  User ||--o{ ProgressEvent : "user"
  PlanTask |o--o{ ProgressEvent : "task"
  Skill |o--o{ ProgressEvent : "skill"
  User ||--o{ Application : "user"
  JobDescription |o--o{ Application : "jobDescription"
  Resume |o--o{ Application : "resume"
  Application ||--o{ ApplicationEvent : "application"
  User ||--o{ ApplicationEvent : "user"
```

### AI usage

Every AI request: model, tokens, latency, outcome; successful results double as a cache.

```mermaid
erDiagram
  User {
    String id PK
    String email UK "nullable"
    String name "nullable"
    String currentRole "nullable"
    Float yearsExperience "nullable"
    String location "nullable"
    String industry "nullable"
    String salaryExpectation "nullable, free text, e.g. '₹18-24 LPA'"
    String careerGoal "nullable"
    Int hoursPerWeek
    DateTime targetDate "nullable"
    DateTime onboardedAt "nullable"
    DateTime createdAt
  }
  AiCall {
    String id PK
    String userId FK "nullable, null for scripts"
    String task "e.g. 'gap.extract', 'interview.score'"
    String promptVersion "nullable"
    String inputHash
    String model "nullable"
    AiCallOutcome outcome
    Int promptTokens "nullable"
    Int completionTokens "nullable"
    Decimal costUsd "nullable"
    Int latencyMs "nullable"
    String error "nullable"
    Json result "nullable"
    DateTime createdAt
  }
  User |o--o{ AiCall : "user"
```

## 3. Table catalog

| Model | Table | Purpose | Unique keys |
|---|---|---|---|
| User | `users` | CareerBuddy: data model on Supabase Postgres. See PLAN.md §5 and ARCHITECTURE.md §7. Json columns are JSONB; validate them with Zod in src/lib before writing and after reading. Every user-owned table carries userId so queries can always be scoped to the session user. ───────────────────────────── Users ───────────────────────────── id is the Supabase auth user id (auth.users.id); the row is created on first sign-in. | email |
| Resume | `resumes` | — | (userId, sha256) |
| UserSkill | `user_skills` | The user's editable skills inventory. Levels: 0 none, 1 beginner, 2 intermediate, 3 advanced, 4 expert. Only demonstrated or assessed evidence may justify level 3+. | (userId, skillId) |
| TargetRole | `target_roles` | — | — |
| JobDescription | `job_descriptions` | — | (userId, contentHash) |
| JobRequirement | `job_requirements` | One skill requirement extracted from one JD, linked to the canonical skill. | — |
| Skill | `skills` | ─────────── Shared skill taxonomy (seeded from prisma/seed) ─────────── Canonical skill taxonomy, shared by all users. Curated rows come from prisma/seed; skills the LLM finds that aren't in the seed are added with curated = false. | slug, name |
| SkillTopic | `skill_topics` | What to learn for a skill, in order, at each tier. Feeds roadmap week content. | (skillId, tier, position) |
| SkillEdge | `skill_edges` | — | PK (fromSkillId, toSkillId, kind) |
| LearningResource | `learning_resources` | — | (skillId, url) |
| RoleTrack | `role_tracks` | Role template: the skills a role needs, grouped by learning tier. Used as a market prior when the user has fewer than 3 JDs, and to order the roadmap. | slug |
| RoleTrackSkill | `role_track_skills` | — | PK (trackId, skillId) |
| GapAnalysis | `gap_analyses` | One analysis run: a resume compared against one or more JDs. Scores are computed in code (src/lib/scoring/gap.ts); the LLM only extracts skills and evidence. | — |
| GapAnalysisJob | `gap_analysis_jobs` | — | PK (analysisId, jobDescriptionId) |
| GapItem | `gap_items` | One row of the skill-gap matrix. | (analysisId, position) |
| LearningPlan | `learning_plans` | Versioned: a replan creates a new row pointing at the previous version. | (gapAnalysisId, version) |
| PlanWeek | `plan_weeks` | — | (planId, weekNumber) |
| PlanTask | `plan_tasks` | — | — |
| PortfolioProject | `portfolio_projects` | — | — |
| InterviewSession | `interview_sessions` | — | — |
| InterviewQuestion | `interview_questions` | — | (sessionId, seq) |
| InterviewEvaluation | `interview_evaluations` | — | questionId |
| ProgressEvent | `progress_events` | Append-only activity log; dashboards and replan rules aggregate over it. | — |
| Application | `applications` | — | — |
| ApplicationEvent | `application_events` | Stage changes and outcomes; the stats in the insights view are computed from these. | — |
| AiCall | `ai_calls` | One row per AI task request (src/lib/ai/service.ts). Successful results are kept so identical requests are served from cache, which matters on the 50/day free tier. | — |

## 4. Enums

| Enum | Values |
|---|---|
| ResumeStatus | `uploaded`, `parsed`, `failed` |
| EvidenceType | `demonstrated`, `mentioned`, `self_reported`, `assessed` |
| JdSource | `pasted`, `file`, `url` |
| RequirementKind | `must`, `nice` |
| RequirementCategory | `must_have`, `good_to_have`, `advanced`, `domain` |
| SkillTier | `fundamental`, `intermediate`, `advanced` |
| EdgeKind | `prereq`, `related` |
| RoleSkillImportance | `core`, `recommended` |
| GapStatus | `matched`, `partial`, `missing` |
| PlanStatus | `draft`, `active`, `superseded`, `completed` |
| TaskKind | `learn`, `exercise`, `coding`, `assessment`, `project_milestone` |
| TaskStatus | `todo`, `doing`, `done`, `skipped`, `missed` |
| ProjectTier | `beginner`, `intermediate`, `advanced`, `production` |
| ProjectStatus | `suggested`, `in_progress`, `done`, `dropped` |
| InterviewKind | `technical`, `coding`, `system_design`, `behavioral`, `role_specific`, `scenario`, `mixed` |
| InterviewStatus | `in_progress`, `completed`, `abandoned` |
| QuestionType | `technical`, `coding`, `behavioral`, `system_design`, `scenario` |
| ProgressKind | `task_completed`, `task_missed`, `hours_logged`, `assessment_scored`, `interview_scored`, `project_milestone`, `skill_level_changed`, `plan_revised` |
| ApplicationStatus | `saved`, `applied`, `screening`, `interviewing`, `offer`, `rejected`, `ghosted`, `withdrawn` |
| ApplicationSource | `referral`, `job_board`, `company_site`, `recruiter`, `other` |
| AiCallOutcome | `ok`, `fallback`, `cache_hit`, `invalid`, `rate_limited`, `error`, `budget_exceeded` |

## 5. Migrations

Applied in order from [prisma/migrations](../prisma/migrations) with `npm run db:deploy`:

- `20261031120000_init`
- `20261031120100_supabase_security`
- `20261031130000_skill_taxonomy`
- `20261031140000_module_tables`
- `20261031150000_gap_item_effort`
