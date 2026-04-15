# JobHub — Project Status Overview
**Date:** 30 March 2026
**Author:** Claude Code (synthesised from full codebase audit)

---

## What This Document Is

A ground-truth snapshot of the JobHub project: what it does, where the code stands, what is working well, what is not, and what needs to be built next. Written for anyone who needs to quickly orient themselves — including future-you returning after time away.

---

## 1. What JobHub Is

JobHub is an AI-powered job application platform built specifically for the **Australian job market**. The core premise: most job seekers aren't underqualified — they're invisible. Their documents don't make it through ATS filters, their cover letters are generic, and their achievements aren't framed to match what employers are looking for.

JobHub solves this with three interlocking capabilities:

1. **Diagnosis** — An AI-powered onboarding intake that reads the user's resume and cover letters, analyses their job search patterns, and produces a personalised diagnostic report identifying exactly where their applications are dropping off.

2. **Evidence Bank** — A structured achievement bank where users store career evidence in STAR format (Situation, Task, Action, Result) with quantified metrics. This becomes the raw material for all document generation.

3. **Targeted Generation** — A hybrid LLM pipeline that matches the achievement bank against a specific job description and generates tailored resumes, cover letters, STAR responses, and (planned) selection criteria — in the user's own voice, calibrated to Australian employer expectations.

**Primary target market:** Australian government and corporate job seekers, where selection criteria responses are a dominant format and ATS filtering is the primary rejection mechanism.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19.2.0, Vite 7.3.1, Tailwind CSS v4, Framer Motion 12.35.2, TanStack Query 5.90, React Router 7.13 |
| Backend | Express 5.2.1, TypeScript 5.9.3, Prisma 6.19.2, Node.js |
| Database | PostgreSQL (hosted on Railway) via Prisma ORM |
| Auth | Supabase (anonymous sessions + magic link + email/password, profile claim migration on re-login) |
| LLM | OpenRouter API — Claude (strategy/quality gate) + Llama 3.3 70B (document execution) |
| Vector DB | Pinecone — per-user achievement embeddings for semantic retrieval |
| Email | Resend |
| Monitoring | Sentry (frontend + backend) |
| Hosting | Frontend → Vercel, Backend → Railway |
| CI | GitHub Actions (TypeScript typecheck on push/PR) |

**LLM Architecture (3 stages):**
1. **Stage 1 — Strategy Blueprint** (Claude via OpenRouter): Analyses JD against profile, selects and ranks achievements, determines document strategy. Result is cached in-memory per user. Cost: ~$0.01–0.03 per call.
2. **Stage 2 — Document Execution** (Llama 3.3 70B via OpenRouter): Follows the blueprint to write the actual document content. Fast and cheap (~$0.001–0.005).
3. **Stage 3 — Quality Gate** (Claude): Optional review pass. Checks document against rules file, flags failures. Not always invoked.

---

## 3. Current Feature Set

### ✅ Complete and Working

| Feature | Where |
|---------|-------|
| Anonymous sessions → authenticated migration | Supabase Auth, `src/hooks/useAuth.tsx` |
| Magic link login for returning users | `server/src/routes/auth.ts` + `Resend` |
| Resume upload and extraction (PDF + DOCX) | `server/src/services/pdf.ts`, `server/src/routes/extract.ts` |
| Auto-extract resume data into profile fields | `server/src/services/autoExtract.ts` |
| Profile management (experience, education, certs, skills) | `src/components/ProfileBank.tsx` (~42KB) |
| Achievement bank with STAR structure + metrics | `src/components/AchievementBank.tsx` + Pinecone indexing |
| Achievement bank search + quality filter | `src/components/AchievementBank.tsx` |
| Match Engine — paste JD → semantic analysis | `src/components/MatchEngine.tsx`, `server/src/routes/analyze.ts` |
| Skills gap analysis | `server/src/routes/analyze.ts` `/gap` |
| JD summary extraction (role, skills, arrangement) | `server/src/routes/analyze.ts` `/jd-summary` |
| Achievement suggestions for a given JD | `server/src/routes/analyze.ts` `/achievement-suggestions` |
| Document generation (resume, cover letter, STAR) | `server/src/routes/generate.ts`, `services/generation.ts`, `services/strategy.ts` |
| Smart regeneration with user feedback | `server/src/routes/generate.ts` |
| Company research panel | `src/components/CompanyResearchPanel.tsx`, `server/src/routes/research.ts` |
| Interview prep with flashcard practice mode | `src/components/InterviewQuestionsPanel.tsx` |
| ATS keyword coverage panel + score | `src/components/ATSCoveragePanel.tsx`, `server/src/routes/document-qa.ts` |
| Resume scorecard (5 dimensions) | `src/components/ResumeScorecardPanel.tsx`, `server/src/routes/document-qa.ts` |
| Cover letter personalisation score | `src/components/CoverLetterPersonalisationPanel.tsx`, `server/src/routes/document-qa.ts` |
| Tone rewrite panel (5 tones) | `src/components/ToneRewritePanel.tsx`, `server/src/routes/document-qa.ts` |
| AI achievement polisher (STAR format) | `server/src/routes/ai-tools.ts` `/polish-achievement` |
| Email version of cover letter | `server/src/routes/ai-tools.ts` `/email-cover-letter` |
| Profile advisor (graded A-D with improvements) | `server/src/routes/ai-tools.ts` `/profile-advisor` |
| Notes action item extractor | `server/src/routes/ai-tools.ts` `/notes-actions` |
| Application tracker with kanban-style stages | `src/components/ApplicationTracker.tsx` (~83KB) |
| Application sort (newest/priority/A-Z/deadline) | `src/components/ApplicationTracker.tsx` |
| Closing date + urgency badges | `src/components/ApplicationTracker.tsx`, DB migration applied |
| Pipeline funnel with conversion rates | `src/components/ApplicationTracker.tsx` |
| Email template library (cold outreach, follow-up, rejection response) | `src/components/EmailTemplatesLibrary.tsx` |
| Document library with search, filter, preview, delete | `src/components/DocumentLibrary.tsx` |
| Dashboard pipeline stats row + upcoming deadlines | `src/App.tsx` Dashboard component |
| AI diagnostic report (onboarding intake) | `src/components/OnboardingIntake.tsx`, `server/src/routes/onboarding.ts` |
| Report experience (full-screen styled diagnostic) | `src/components/ReportExperience.tsx` |
| Dark/light theme with OKLCH-based tokens | `src/contexts/ThemeContext.tsx` |
| Hue customisation (5 presets + custom) | `src/components/HuePicker.tsx` |
| Rate limiting on `/api/analyze` (30 req/15 min) | `server/src/middleware/analyzeRateLimit.ts` |
| Error monitoring (Sentry frontend + backend) | Sentry SDK integrated |
| Health endpoint | `server/src/routes/health.ts` |

### 🔶 Partially Complete

| Feature | Status | Gap |
|---------|--------|-----|
| PDF export | `@react-pdf/renderer` installed, no export route built yet | Export service + route + client buttons needed |
| DOCX export | `docx` package not yet installed | Export service + route + client buttons needed |
| Document feedback loop | Model designed in Phase 1 spec, not yet migrated | `DocumentFeedback` model + `/api/feedback/document` route + feedback bar UI |
| Selection criteria generation | `requiresSelectionCriteria` flag exists, `SELECTION_CRITERIA` document type not in route mapping | Detection, format logic, generation prompt, SC-specific rules, UI for criterion input |
| Email notifications | `services/email.ts` + Resend configured, partial use | Delivery is wired for magic link; broader notification triggers not implemented |
| Voice profile extraction | Planned in onboarding spec, fields exist on schema | Extraction logic not built; not injected into generation prompts |
| Context injection (target role into every generation) | `targetRole` exists on profile | Not yet passed into blueprint/strategy prompt |

### ❌ Not Yet Built

| Feature | Notes |
|---------|-------|
| Testing infrastructure | Zero test files. No Vitest, Jest, or Playwright configured. |
| DOCX export | Not started |
| Selection criteria full feature | Needs job type detection, SC parsing UI, level calibration, DOCX template |
| Chrome extension | Planned, not started |
| Responsiveness / mobile UI | Fixed sidebar widths, not mobile-friendly |
| Re-intake flow (30-day update) | DiagnosticReport schema ready, trigger logic not built |
| Gap analysis UI in Achievement Bank | Planned in onboarding spec |
| EmailTemplatesLibrary routing | Component exists but not wired into App.tsx routes or DashboardLayout nav |

---

## 4. Architecture Overview

### Backend Routes (11 files)

```
/api/health          → health.ts          Simple uptime check
/api/auth            → auth.ts            Magic link + Supabase passthrough
/api/extract         → extract.ts         Resume upload, PDF/DOCX parsing
/api/onboarding      → onboarding.ts      Intake form, diagnostic report generation
/api/profile         → profile.ts         Full CRUD for profile, experience, education,
                                           achievements, jobs, documents (~34KB)
/api/analyze         → analyze.ts         JD match, gap analysis, achievement suggestions, JD summary
/api/analyze         → ai-tools.ts        Polish achievement, interview Qs, email cover letter,
                                           profile advisor, notes actions
/api/analyze         → document-qa.ts     ATS coverage, resume score, cover letter personalisation, tone rewrite
/api/generate        → generate.ts        Blueprint + document generation
/api/research        → research.ts        Company research (Serper web search)
/api/documents       → documents.ts       List + delete documents
```

All `/api/analyze` routes are protected by `authenticate` + `analyzeRateLimit` middleware at the router level.

### Frontend Routes

```
/                 Dashboard (stats, deadlines, report card)
/match            MatchEngine (paste JD → analysis)
/workspace/:id    ApplicationWorkspace (generate documents for a job)
/tracker          ApplicationTracker (manage all applications)
/profile          ProfileBank (manage profile and achievements)
/documents        DocumentLibrary (view/search/download generated docs)
/onboarding       OnboardingGate → OnboardingIntake
/report           ReportExperience (full-screen diagnostic)
/auth             AuthPage
```

**Note:** EmailTemplatesLibrary exists as a component but has no route.

### Data Model (12 Prisma models)

```
CandidateProfile ─┬─ Experience ──── Achievement
                  ├─ Education
                  ├─ Volunteering
                  ├─ Certification
                  ├─ Language
                  ├─ Achievement (direct, no experience link)
                  ├─ JobApplication ── Document
                  ├─ ResumeVersion
                  └─ DiagnosticReport ── DiagnosticReportFeedback
```

Key design choices:
- `CandidateProfile.userId` is the Supabase Auth UID — the single join key between auth and data
- Achievements can belong to an Experience OR directly to the profile
- Documents belong to a JobApplication — every generated document is scoped to a specific job
- DiagnosticReport is one-per-user (`userId @unique`)

---

## 5. What Is Not Working Well

### 5.1 ApplicationTracker is Too Large
`ApplicationTracker.tsx` is 83KB / ~2,500 lines. It handles job card display, inline editing, sorting, filtering, pipeline funnel, action item extraction, and multiple API calls. This is a maintenance and debugging burden. Splitting into `JobCard`, `PipelineFunnel`, `SortControls`, and `TrackerPage` would dramatically improve navigability.

Similarly, `profile.ts` on the backend is 34KB — a monolith covering experience, education, certifications, skills, achievements, and job applications. Splitting into domain-specific route files would improve clarity.

### 5.2 No Export (PDF / DOCX)
Users can preview generated documents and copy text, but there is no way to download a properly formatted file. This is the most critical missing capability for actual job application use — you cannot attach a copy-pasted document. The Phase 1 spec has this fully designed; it just needs to be built.

### 5.3 No Document Feedback Loop
There is no way for users to rate generated documents or identify weak sections. Without this signal, it is impossible to know which prompts are underperforming. The Phase 1 spec has the data model and UX designed.

### 5.4 In-Memory Blueprint Cache
`services/blueprint-cache.ts` stores strategy blueprints in a `Map`. Every Railway deployment restart clears all cached blueprints. This is invisible to users (they just see a slower first generation after a deploy) but means the system is silently degraded after deploys or crashes. A Redis-backed or database-persisted cache would fix this.

### 5.5 prompts.ts is 42KB
All LLM prompt templates live in a single file. Adding a new document type, modifying STAR proportions, or adjusting tone guidance requires navigating a 42KB file. A per-document-type structure (one file per `DocumentType`) would make prompt maintenance tractable.

### 5.6 Zero Test Coverage
No tests exist for any route, service, or component. The rate limiting middleware, auth middleware, LLM retry logic, and prompt structure are untested. Before adding significant new features, a baseline of integration tests for the core routes (`/api/analyze/job`, `/api/generate`, `/api/extract`) would reduce regression risk.

### 5.7 Selection Criteria Not Fully Implemented
The `requiresSelectionCriteria` flag is set during job analysis, and `SELECTION_CRITERIA` exists as a DocumentType enum value. But the generation route does not handle it — it falls through to the default document type. For Australian government and university jobs (a huge share of the target market), this is a significant gap.

### 5.8 EmailTemplatesLibrary is Orphaned
The `EmailTemplatesLibrary.tsx` component (14.8KB) was built but never wired into a route or the navigation. Users cannot access it.

### 5.9 No Mobile Experience
The layout uses fixed sidebar widths (320px) and hardcoded font sizes. On a phone, the sidebar dominates the viewport and the content is unusable. Not a blocker for an MVP, but job searching is increasingly mobile-first.

### 5.10 Voice Profile Not Used
Onboarding intake extracts cover letters specifically to learn the user's writing voice. But the extracted voice profile is not yet passed into the document generation pipeline. All generated documents sound like "the system" rather than the user.

---

## 6. What Is Working Well

- **Core intelligence pipeline is solid.** The 3-stage LLM architecture (Claude strategy → Llama execution → Claude quality gate) is well-designed and already producing high-quality documents. The separation of strategic reasoning from execution is the right call.

- **Achievement bank is the right mental model.** Structuring evidence as discrete STAR achievements with metrics, rather than a monolithic resume blob, is genuinely novel and gives the generation pipeline much better raw material to work with.

- **Auth migration is handled cleanly.** Anonymous sessions that migrate to authenticated accounts on re-login is a difficult UX problem. The Supabase integration handles this well, and magic links reduce friction for returning users.

- **Rate limiting is now in place.** The 30 req/15 min sliding-window limiter protects the expensive LLM endpoints. Applied at the router level after `authenticate`, so `req.user.id` is always available.

- **Theme system is coherent.** The `ThemeContext` with `T.*` token objects (light/dark, OKLCH-based) gives components a consistent theming API. The hue slider is a nice differentiator.

- **CI is now set up.** The GitHub Actions workflow runs TypeScript typechecks on both frontend and backend on every push, with `prisma generate` before the backend check.

- **Onboarding diagnostic report is genuinely valuable.** The diagnostic prompt covers targeting, document audit, pipeline diagnosis, and an honest assessment with a 3-step fix. This is the product's strongest hook — it turns a frustrating job search into a solvable positioning problem.

- **Route split is now clean.** The previous 924-line `analyze.ts` monolith is split into three focused files: core analysis, AI writing tools, and document QA. Each file has clear purpose and the rate limiting is consistently applied.

---

## 7. Open Technical Debt

| Item | Severity | Effort |
|------|----------|--------|
| No PDF/DOCX export | Critical | Medium (2–3 days) |
| No document feedback | High | Medium (2 days) |
| In-memory blueprint cache | Medium | Low (0.5 days — add DB column) |
| prompts.ts 42KB monolith | Medium | Medium (2 days to split) |
| ApplicationTracker.tsx 83KB | Medium | Medium (2 days to split) |
| profile.ts 34KB backend monolith | Low | Low (1 day) |
| EmailTemplatesLibrary orphaned | Medium | Low (1 hour — add route + nav) |
| Zero test coverage | High | High (ongoing) |
| Selection criteria not wired | High | High (5–8 days for full feature) |
| Voice profile not injected | Medium | Low (1 day) |
| No mobile layout | Low | Medium (3–5 days) |
| Blueprint cache clears on restart | Medium | Low (0.5 days) |

---

## 8. Planned Work (Prioritised)

### Now — Quick Wins (< 1 day each)

1. **Wire EmailTemplatesLibrary** — Add `/email-templates` route to `App.tsx`, add nav link to `DashboardLayout.tsx`. The component is complete.

2. **Voice profile injection** — Pass `targetRole`, `targetCity`, and any extracted voice signal from `CandidateProfile` into the strategy blueprint prompt (`services/strategy.ts`). Existing fields, existing pipeline — just a data wiring task.

### Sprint 1 — Core Output Quality (1–2 weeks)

Per the approved Phase 1 spec (`2026-03-27-phase1-output-quality-design.md`):

3. **Document feedback loop** — Add `DocumentFeedback` model, migrate DB, add `POST /api/feedback/document` route (with ownership check), add compact feedback bar to generated document view.

4. **PDF export** — `@react-pdf/renderer` is already installed on the server. Add `services/export.ts` with `exportToPDF()`, add `POST /api/export/:documentId?format=pdf` route, wire download buttons in `ApplicationWorkspace.tsx`.

5. **DOCX export** — `npm install docx` (server), add `exportToDOCX()` to export service, add format param to export route.

6. **Selection Criteria — Foundation** — Add `SELECTION_CRITERIA` to route mapping in `generate.ts`, write SC-specific generation prompt (per SC rules file), add criterion input UI to `CriteriaInputPanel.tsx`.

### Sprint 2 — Polish + Conversion (1–2 weeks)

Per the approved feature evaluation (`2026-03-28-feature-evaluation.md`):

7. **Report layout** — Full-width horizontal islands replacing the masonry grid. Enforces correct read order and makes section purpose clear.

8. **Color system consolidation** — Define `--hue` CSS variable, derive all brand colors from it. Resolve the `var(--text-main, #f1f5f9)` pitfall — this pattern is dangerous and may be lurking in other components.

9. **Beam transition** — "Let's Go" → dashboard reveal sequence (500–700ms, exponential easing).

### Sprint 3 — Infrastructure (ongoing)

10. **Testing baseline** — Vitest for server route integration tests. Start with `/api/analyze/job`, `/api/extract`, and the rate limiter middleware. Even 10 tests covering the critical path would be a step change.

11. **Blueprint cache persistence** — Add a `blueprintCacheKey` + `blueprintJson` column to `JobApplication`, store after generation, retrieve before generation.

12. **prompts.ts split** — One file per DocumentType. Easier to audit, review, and update prompt quality.

---

## 9. Key Files to Know

| File | Purpose | Size |
|------|---------|------|
| `server/src/services/prompts.ts` | All LLM prompts — the "brain" of the system | 42KB |
| `server/src/routes/generate.ts` | Document generation orchestration | 11KB |
| `server/src/services/generation.ts` | Achievement ranking + generation pipeline | 5.8KB |
| `server/src/services/strategy.ts` | Stage 1 Claude blueprint | 2.2KB |
| `server/src/services/quality-gate.ts` | Stage 3 quality review | 2.2KB |
| `src/components/ApplicationWorkspace.tsx` | Main generation UI (post-analysis) | 80KB |
| `src/components/ApplicationTracker.tsx` | Full tracker with pipeline funnel | 83KB |
| `src/components/ProfileBank.tsx` | Achievement bank + profile editing | 42KB |
| `src/contexts/ThemeContext.tsx` | Theme tokens — always use `T.*`, never hardcoded Tailwind |  |
| `server/prisma/schema.prisma` | Source of truth for data model |  |
| `server/src/middleware/analyzeRateLimit.ts` | Per-user sliding-window rate limiter |  |

---

## 10. Environment Variables

**Frontend (`.env.example`):**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=https://your-backend.railway.app/api
VITE_SENTRY_DSN=
```

**Backend (`server/.env.example`):**
```
OPENROUTER_API_KEY=       # LLM API (Claude + Llama via OpenRouter)
DATABASE_URL=             # PostgreSQL connection string
SUPABASE_URL=             # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY= # Server-side Supabase key
PINECONE_API_KEY=         # Vector DB
PINECONE_INDEX_NAME=      # Default: jobhub-achievements
SENTRY_DSN=               # Optional error monitoring
NODE_ENV=production
ALLOWED_ORIGIN=           # Frontend URL(s), comma-separated
PORT=3002
```

---

## 11. Recent Development Trajectory

The last 20 commits (since approximately 20 March 2026) show rapid, feature-focused development:

- **Infrastructure fixes:** Rate limiting, CI/CD, route splits, console override fix, theme contrast fixes
- **Document QA tools:** ATS coverage score, resume scorecard, cover letter personalisation, tone rewriter
- **Application management:** Closing dates + urgency badges, pipeline funnel, sort controls, action item extraction
- **Generation tools:** AI achievement polisher, email cover letter transformer, cold outreach generator, rejection response, smart regeneration
- **Interview prep:** Question generator with flashcard practice mode
- **Dashboard:** Pipeline stats, upcoming deadlines, document library

The codebase is at a natural inflection point: **breadth of features is strong; depth of quality and completeness on core features (export, feedback, selection criteria) now needs to catch up.**

---

*Document generated from full codebase audit on 30 March 2026. Cross-checked against: all route files, all service files, Prisma schema, 35 frontend components, both `.env.example` files, all planning documents in `docs/superpowers/specs/`, and the last 30 git commits.*
