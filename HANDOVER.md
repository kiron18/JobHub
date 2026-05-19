# JobHub — Agent Handover

> Read this end-to-end before touching code. It is intentionally dense — every section answers a real question that comes up when working on this project.

You are taking over from a prior CLI agent. The codebase has shipped a substantial amount of working product; your job is to **extend it without regressing it**. Bias toward small, reversible changes. When in doubt, **ask the user before touching anything destructive** (deletes, migrations, force pushes, dependency changes).

---

## 1. Product, in one paragraph

JobHub is a pre-launch AI-powered job-search platform. A user uploads their resume, the system parses it into a structured **Achievement Bank**, runs a diagnostic, then helps them apply to roles: paste a job description (JD) → tailored resume + cover letter → one-click apply via a deep link. The product's edge is *trust* — generated content must be accurate, evidence-based, and ready-to-send without second-guessing.

**Owner:** Kiron (founder/product owner, email `kiron182@gmail.com`). Thinks in product strategy, not just features. Wants emotional design ("unwrapping a Christmas gift" feel). Prefers terse responses, no padding.

**North star:** Every feature must obsessively improve the product for the consumer. Every feature should have a feedback/learning loop from day one.

---

## 2. Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 19 + Vite 7, TypeScript, Tailwind v4 (no `tailwind.config.js` — config lives in `src/index.css`), Framer Motion, Lucide icons, React Router 7, TanStack Query, Sonner toasts, Supabase Auth |
| Backend | Node + Express 5, TypeScript, `tsx watch` for dev |
| DB | PostgreSQL via Prisma. Local dev uses SQLite at `server/prisma/dev.db` (the schema is Postgres-flavoured but `db push` works) |
| LLM | OpenRouter (Meta Llama 3.3 70B by default). Also Google GenAI for some flows. Pinecone for vectors. |
| Auth | Supabase. **In dev**, `DEV_BYPASS_AUTH=true` short-circuits to `kiron182@gmail.com`. |
| Payments | Stripe |
| Deploy | Frontend → Vercel. Backend → Railway (see `server/railway.json`, `server/nixpacks.toml`). |
| Errors | Sentry on both client and server |
| Analytics | PostHog client-side, Vercel Analytics |
| Tests | Vitest on server. Promptfoo for LLM eval (`evals/promptfooconfig.yaml`). No frontend test suite. |

---

## 3. Run it locally

```bash
# Backend (terminal 1)
cd server
npm install
npm run dev              # http://localhost:3002

# Frontend (terminal 2, repo root)
npm install
npm run dev              # http://localhost:3000
```

### Env files

`/.env.local` (frontend):
```
VITE_API_URL=http://localhost:3002/api
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

`server/.env`:
```
DATABASE_URL=postgresql://...      # or use local sqlite via dev.db
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
PORT=3002
DEV_BYPASS_AUTH=true
NODE_ENV=development
OPENROUTER_API_KEY=...
# Other keys as features need: STRIPE_*, PINECONE_*, RESEND_API_KEY, GOOGLE_GENAI_API_KEY, APIFY_TOKEN
```

### Useful commands

```bash
# Frontend
npm run build            # tsc -b && vite build  — run before claiming "done"
npm run lint
npm run eval             # promptfoo eval on LLM prompts

# Backend
cd server
npm run test             # vitest
npx prisma generate      # after schema changes
npx prisma db push       # apply schema to dev.db
node scripts/migrate-safe.js  # production-safe migration runner
```

### Port conflicts (Windows)
```powershell
netstat -ano | findstr :3000
taskkill /F /PID <pid>
```

---

## 4. Repo map

```
JobHub/
├─ src/                         # React frontend
│  ├─ App.tsx                   # Router + ReportOrDashboard state machine + auth wrapper
│  ├─ components/               # Feature components (see §6 for the important ones)
│  ├─ pages/                    # Top-level routed pages (StrategyHub, StepperWorkspace, ...)
│  ├─ layouts/DashboardLayout.tsx
│  ├─ contexts/                 # AuthContext, ThemeContext
│  ├─ lib/                      # api client, exporters, parsers, supabase, strategic-intelligence
│  ├─ services/api.ts
│  ├─ data/, hooks/, types/, styles/, assets/
│  └─ index.css                 # Tailwind v4 theme + custom CSS
├─ server/
│  ├─ src/
│  │  ├─ index.ts               # Express entry
│  │  ├─ routes/                # Express routers (one file per resource — see §5)
│  │  ├─ services/              # LLM, scoring, parsing, scrapers, generation, etc.
│  │  ├─ middleware/, lib/, utils/, cron/, scripts/, data/, tests/
│  ├─ prisma/schema.prisma      # Source of truth for DB
│  ├─ rules/                    # Markdown prompt-rule files (resume, cover letter, SC, …)
│  └─ scripts/migrate-safe.js
├─ docs/
│  ├─ superpowers/specs/        # Design specs by date (start here for "why")
│  ├─ superpowers/plans/        # Implementation plans paired with specs
│  ├─ product-decisions/        # Standalone strategy notes
│  └─ data-tracking-roadmap.md, admin-*.md, testing-payments.md
├─ evals/                       # Promptfoo configs for LLM eval
├─ Resumes/, Report/, screenshots/, svg Library/
├─ guiding_document.md          # Old high-level overview (still mostly accurate at the top, stale near the bottom)
├─ LOCAL_DEV.md
└─ Audit rules.txt, Diagnostic_Rework.md, plan.md, onboarding_intake_plan.md
```

---

## 5. Backend routes (one file per resource)

`server/src/routes/`:

| Route | Purpose |
|---|---|
| `auth.ts` | Supabase auth helpers + dev-bypass |
| `onboarding.ts` | Intake submission, profile init |
| `extract.ts` | `POST /api/extract/resume` — 2-stage LLM extraction (structure → achievements) |
| `analyze.ts` | `POST /api/analyze/job` and `POST /api/analyze/dual` (dual-signal, returns `enrichmentCandidates`) |
| `enrichment.ts` | `/api/enrichment/questions`, `/parse-answer` — JD-time metric capture |
| `generate.ts` | Resume / cover letter / SC generation |
| `documents.ts` | CRUD on generated docs |
| `document-qa.ts` | Quality gate on generated docs |
| `feedback.ts` | Section-level relevance feedback collection |
| `insights.ts` | `/api/insights/application-pattern`, Strategic Intelligence endpoints |
| `job-feed.ts` | Daily job feed; `:id/fetch-description`, `:id/save`, `:id/mark-applied` |
| `linkedin.ts` | LinkedIn hub (scraping via Apify) |
| `research.ts` | Company research panel |
| `skool.ts` | Skool community gating |
| `stripe.ts`, `webhooks.ts` | Payments |
| `admin.ts`, `admin-funnel.ts` | Admin dashboards |
| `health.ts`, `ai-tools.ts`, `profile/` | Misc |

Services (`server/src/services/`) hold the actual logic — routes are thin wrappers. **LLM calls always go through `services/llm.ts`** (OpenRouter client + retries + logging). Prompt rules live in `server/rules/*.md` and are loaded at runtime; edit the markdown to tune model behaviour without redeploying logic.

---

## 6. Frontend flow — the part that ships every week

The activation + apply flow as of 2026-05-19 (post-diagnostic flow redesigned):

```
Onboarding intake → Resume upload → ProcessingScreen
   ↓
ReportOrDashboard state machine (src/App.tsx):
   - empty parse → FromScratchCapture (4-prompt fallback)
   - normal parse → DiagnosticPage (merged urgency header + full report, polls for diagnostic)
   - reportSeen → Dashboard (StrategyHub)
   ↓
Dashboard (/) — StrategyHub
   - AnalysisHeroCard with JD textarea
   - ApplyFeedStrip above textarea: top 5 feed matches, click → hydrate full JD via /job-feed/:id/fetch-description
   - Paste JD → Analyse → /analyze/dual (returns enrichmentCandidates)
   - AnalysisResult inline: EnrichmentPrompt fires if achievements lack metrics
   - Continue → /apply with feedItemId + sourceUrl threaded through state
   ↓
StepperWorkspace (/apply) — Resume → Cover Letter → (SC) → Track
   - Each step gates on draft existence
   - TrackStep renders ApplyDeepLinkButton when both resume + cover ready:
     copies cover letter to clipboard, downloads both as PDFs (DOCX as alt),
     POSTs /job-feed/:id/mark-applied, opens sourceUrl in new tab
   ↓
Dashboard return — StaleApplicationsCard nudges status updates for
APPLIED apps >5 days old (Interview unlocks Interview Prep generation).
```

**The 7-step `SetupWizard` was deleted on 2026-05-16. Do not reintroduce it.**

### Important components

- `OnboardingGate.tsx` — owns the auth/profile gate. Triggers `OnboardingIntake` for new visitors and the `ReportOrDashboard` state machine for returning ones.
- `OnboardingIntake.tsx` — visual reference for **colour/typography/style**. The dashboard must match it (see §8).
- `StrategyHub.tsx` (pages/) — the main dashboard. Contains `AnalysisHeroCard`, `ApplyFeedStrip`, `StrategicIntelligenceCard`, `StrategicInsightsPanel`, `PipelineGlance`, `StaleApplicationsCard`.
- `StepperWorkspace.tsx` — the apply flow.
- `ApplicationWorkspace.tsx` — the editor for resume/cover letter/SC drafts. **Parses inline tokens** (see §9).
- `ReportExperience.tsx` — the diagnostic report renderer.
- `FromScratchCapture.tsx` — fallback when resume parse is essentially empty. **Currently collects only `targetRole` + `targetCity`** — missing `seniority` and `visaStatus`. Riskiest cohort still has degraded first generations. Known debt.

---

## 7. Database schema (highlights)

`server/prisma/schema.prisma` — Postgres in prod, SQLite locally. Top-level models:

- `CandidateProfile` — one per user. Stores raw resume text, raw cover-letter text, intake answers (`targetRole`, `targetCity`, `seniority`, `visaStatus`, `industry`, `applicationsCount`, `searchDuration`, `perceivedBlocker`, `responsePattern`), Stripe state, plan/quota counters, headshot state, identity cards, positioningStatement, marketing consent. **`hasCompletedOnboarding`** gates the dashboard.
- `Achievement` — the "gold mines" extracted from resumes (description, metric, date, skills, tags).
- `Experience`, `Education`, `Certification`, `Language`, `Volunteering` — resume sub-structures.
- `ResumeVersion` — historical resume variants.
- `JobApplication` — the tracker (status, dates, links).
- `JobFeedItem` — daily-feed entries (Seek / Apify scraped).
- `DiagnosticReport` — generated report payload.

When changing schema: edit `schema.prisma`, run `npx prisma generate`, then `npx prisma db push` for dev. For prod use `node scripts/migrate-safe.js`. **Never blind-drop columns** — surface the plan to the user first.

---

## 8. Standing visual / UX rules (read these — they have been forgotten repeatedly)

1. **The design system is the master reference — all surfaces must match it.** The canonical design system document is at `docs/design-system/DESIGN.md`. The philosophical companion is at `docs/product-decisions/2026-05-19 Design guide.md`. Design tokens (colors, typography, spacing, motion) are defined in `src/index.css` (`@theme`) and `ThemeContext.tsx`. Every UI component must use these tokens — no ad-hoc colors or spacing. The generated application documents (resume, cover letter, SC) are exempt from the visual redesign but must still pass through the export pipeline correctly.
2. **Invoke the design discipline before writing significant UI.** Type, colour, spacing, motion choices must be deliberate, not improvised.
3. **No voice-profile injection.** Generation prompts target clean, professional, evidence-based language per the rules files in `server/rules/`. Do **not** mirror the user's existing writing — if their writing were good they wouldn't need us.
4. **Robust > quick** when forced to choose. The user has explicitly preferred 4-hour structurally clean over 1-hour lossy. Surface both options with their trade-offs.
5. **No emojis in code or commit messages** unless the user explicitly asks.
6. **Don't add backwards-compat shims, dead-code re-exports, "removed" comments, or feature flags for hypothetical futures.** If something is unused, delete it.
7. **Don't write what-comments** — only why-comments for non-obvious invariants. Avoid referencing the current task or PR in comments.

---

## 9. The inline-token convention (load-bearing — do not break)

`Document.content` is a single `String` column. To carry per-element metadata that is screen-only and never reaches the recruiter, the editor uses **inline markdown tokens**:

| Token | Behaviour | Renderer |
|---|---|---|
| `[VERIFY: text]` | Pill in a top bar above the document | `parseVerifyTokens` in `ApplicationWorkspace.tsx` (~line 700) |
| `[MISSING: text]` | Inline `<MissingFlag>` widget | `text` component override (~line 1543) |
| `[AI]` | Inline `<AIRewriteBadge>` prefix on AI-rewritten bullets | `text` component override |

**Critical rule:** every token must be stripped by **both** exporters before output:
- `src/lib/exportDocx.ts` → `sanitizeForExport`
- `src/lib/exportPdf.tsx` → `sanitizeForExport`

If you add a new token, update both regexes. If you add a new exporter, run it through `sanitizeForExport`. Tokens are display-time overlays only — for anything that needs querying/sorting/filtering use a real column.

---

## 10. LLM patterns

- All LLM calls funnel through `server/src/services/llm.ts`. Add new prompts as files under `server/src/services/prompts/` and rule sets under `server/rules/`.
- Server tags AI-rewritten bullets with `[AI]` based on Jaccard ≥ 0.7 vs original — see slice-2 plan.
- `enrichmentCandidates` is returned by both `/analyze/job` and `/analyze/dual`. When wiring new flows that need enrichment, prefer `/analyze/dual`.
- Section-level relevance feedback is more actionable than aggregate. Always add a feedback hook to new LLM-generated surfaces.
- Use `promptfoo` (`npm run eval`) to validate prompt changes before shipping.

---

## 11. Known debt / open follow-ups

Treat these as known — don't "fix" silently; check with the user before scoping.

- **22+ unpushed commits on master** as of 2026-05-17 — verify state before pushing.
- **Strategic Intelligence unlock state lives in `localStorage`.** Migrate to a `strategic_intelligence_unlocks` JSON column on `CandidateProfile` when cross-device support lands. See `src/lib/strategicIntelligence.ts` and the slice-3 plan.
- **Industry Fit Map** is flagged `implemented: false` — needs an industry column on `JobApplication` (could be LLM-derived per row).
- **FromScratchCapture missing fields** — only captures `targetRole` + `targetCity`. Needs `seniority` + `visaStatus`.
- **TrackStep auto-save vs `/job-feed/:id/save`** has a hardcoded duplicate-row risk. Known, not blocking.
- Focus-cascade keyboard flow across analyse → generate buttons is unpolished.
- No frontend test suite. Server uses Vitest.

---

## 12. Where to find "why"

When you need motivation for a piece of code, check in this order:

1. `docs/superpowers/specs/<date>-<topic>.md` — what we decided to build and why.
2. `docs/superpowers/plans/<date>-<topic>.md` — how we broke it into shipping slices.
3. `docs/product-decisions/<date>-<topic>.md` — standalone strategy notes.
4. `git log -- <path>` — paired commit messages.
5. Last resort: read the code.

Most recent and relevant:
- `docs/superpowers/specs/2026-05-16-post-diagnostic-flow-redesign.md`
- `docs/superpowers/plans/2026-05-16-slice-{1,2,3}-*.md`
- `docs/product-decisions/2026-05-12-Job Hub Revamped.md`
- `docs/product-decisions/2026-05-12-retention-roadmap.md`
- `docs/product-decisions/2026-05-13-Diagnostic revamp.md`
- `docs/product-decisions/2026-05-14-Section 5 revamp.md`

When you add a meaningful change, **write a new spec and plan in the same convention** so the next agent (or future you) can pick up the thread.

---

## 13. Commit / branch conventions

Looking at recent log (`git log -n 5`):
```
copy(diagnostic): retarget end-of-report CTA to "Start my first application"
fix(onboarding): the actual bug — stop setting hasCompletedOnboarding eagerly
fix(onboarding): wait for profile refetch before from-scratch decision
fix(onboarding): await autoExtract before status=COMPLETE to close race condition
fix(strategy): collapse ApplyFeedStrip to a sleek single-line Seek banner
```

- Conventional-commit prefixes: `feat`, `fix`, `copy`, `refactor`, `chore`, `docs`. Scope in parens.
- Lowercase subject. Em-dashes are fine. No emojis. No trailing period.
- The body explains *why*, not *what*.
- **Never commit `.env*`, `dev.db`, or anything in `Resumes/` without explicit permission.**
- Default branch: `master`.
- Never force-push to `master`. Never `git reset --hard` shared branches.

---

## 14. Working style with the user

- Be concise. No padding, no over-explanation, no trailing summaries that just restate the diff.
- For exploratory questions, 2–3 sentences with a recommendation + tradeoff. Wait for buy-in before implementing.
- For multi-step changes, write a brief plan inline, get nodding, then execute.
- Match action scope to what was asked. A bugfix is not licence to refactor surrounding code.
- Trust the user's product instincts but push back when warranted.
- Before claiming "done", actually run the build / start the dev server / click through the flow. Type-check ≠ feature-works.
- When you hit a constraint, surface a creative third option before settling for the lossy one.

---

## 15. Safety checklist before any non-trivial change

- [ ] I have read the relevant spec / plan in `docs/superpowers/`.
- [ ] If I'm changing UI, the dashboard still matches onboarding style.
- [ ] If I'm adding inline tokens or exporters, both `sanitizeForExport` regexes are updated.
- [ ] If I'm adding LLM logic, the prompt lives in `server/rules/` or `services/prompts/` and there's an eval.
- [ ] If I'm changing schema, I have a migration path and ran `prisma generate`.
- [ ] No `.env`, secrets, or large binaries are staged.
- [ ] I ran `npm run build` (frontend) or `npm run test` (server) for the slice I touched.
- [ ] I have not amended a published commit.

---

If anything in this doc contradicts what you observe in code, **trust the code** and update this doc.
