# Business Overview — JobHub

*Generated: 2026-05-07. Answers based on current codebase, docs, and plans — not marketing.*

---

## 1. Product Description

JobHub is an AI-powered job application platform for Australian job seekers that diagnoses why applications are failing and generates tailored resumes, cover letters, and selection criteria matched to each role.

---

## 2. Mission

Most Australian job seekers are not underqualified — they are invisible. Their resumes don't pass ATS filters, their cover letters are generic templates, and their achievements aren't framed to match what employers need. JobHub solves this by combining diagnostic analysis of a user's job search patterns with an achievement bank that powers targeted document generation in the user's own voice, calibrated to Australian employer expectations and selection criteria formats.

The problem is structural: job application tooling has historically been either generic (Word templates) or untargeted (mass apply tools). No product has connected *why you're not getting interviews* to *exactly how to fix your documents for this specific role.* The timing is right because LLM quality now allows per-role tailoring at near-zero marginal cost.

---

## 3. What a User Actually Does and Gets

A user signs up, completes a 7-step onboarding intake (uploading a resume, answering questions about their role target, work rights, and timeline), and receives a **diagnostic report** identifying specific gaps: missing skills, weak achievement framing, poor keyword coverage, or strategic positioning issues. Once on the dashboard, they paste any job description and get an instant **match analysis** with a score across 10 dimensions. For any role they want to apply to, they generate a tailored resume, cover letter, or selection criteria response — the system pulls relevant STAR-formatted achievements from their bank and writes polished, ATS-friendly documents. They also track applications in a kanban pipeline, browse a daily curated job feed, research companies, prep interview answers, and generate follow-up emails.

---

## 4. Stage, Users & Revenue

**Stage:** Live — Vercel (frontend) + Railway (backend/DB). Functionally complete but pre-scale, in early-adopter phase.

**User count:** Unknown from codebase. Docs reference targets like "when you hit 50+ paying users" and ">100 active users," suggesting current volume is below 50 paying customers.

**Revenue model:**
- Free trial: 5 job analyses over 7 days (email verification required, no credit card initially)
- Paid: $67 AUD/month or $497 AUD/year via Stripe subscriptions
- Exempt (no charge): kiron182@gmail.com, kamiproject2021@gmail.com, kiron@aussiegradcareers.com.au

---

## 5. Product Name, Domain, Tagline

- **Product name:** JobHub (internal codebase name); "AI Job Ready Pro" in HTML title/metadata
- **Domain:** aussiegradcareers.com.au (primary)
- **Backend URL:** Railway-hosted API
- **Tagline:** "AI-powered resumes, cover letters, and job applications for Australian graduates"

---

## 6. Core Features

### ✅ Live

- Anonymous → authenticated account migration (Supabase magic link + Google OAuth)
- Resume/cover letter upload and PDF/DOCX text extraction
- Profile bank (experience, education, certifications, languages, volunteering, projects)
- Achievement bank with STAR-format structure and semantic search (Pinecone vector embeddings)
- Match Engine: paste a job description → instant fit analysis across 10 dimensions (skills gap, keyword alignment, achievement fit, etc.)
- Document generation: tailored resume, cover letter, STAR response, email cover letter
- Smart regeneration with user feedback loop
- Cover letter personalisation scoring + tone rewrite panel (5 tones)
- ATS keyword coverage scoring + resume scorecard (5 dimensions)
- Achievement polisher (STAR format enforcer)
- Profile advisor
- Application tracker (kanban pipeline with stages, sorting, priority badges, deadlines)
- Email template library (cold outreach, follow-up, rejection response, thank you)
- Document library (search, filter, preview, delete)
- Diagnostic report (generated after onboarding intake, 6 collapsible sections)
- Company research panel (Serper web search for company info and hiring manager discovery)
- Interview prep with flashcard practice mode
- Daily job feed (Adzuna API, 10 curated jobs/day, AI-generated bullet summaries, match scoring)
- Payment system (Stripe) with trial access gating via webhooks
- Admin panel (basic dashboarding, Friday brief generation for weekly call scripts)
- Dark/light theme with hue customisation
- Rate limiting (30 req/15 min per IP on analysis endpoint)
- Sentry error monitoring (frontend + backend)

### 🚧 In Progress / Partially Complete

- **PDF/DOCX export** — packages installed (`@react-pdf/renderer`, `docx`), no route or UI built yet; users can copy-paste but cannot download a formatted file (critical gap)
- **Baseline resume** — fire-and-forget generation after diagnostic, download banner on profile; recently shipped, may have rough edges
- **Selection criteria generation** — flag exists in schema, full feature (job type parsing, SC-specific prompts, DOCX template) not complete
- **Blueprint caching** — in-memory cache works but resets on every Railway deploy; Redis/persistent persistence not yet wired
- **Voice profile extraction** — fields exist in schema, extraction logic not connected to generation prompts consistently
- **Document feedback loop** — DB model exists (`DocumentFeedback`), no UI for rating or flagging weak sections

### 💭 Planned

- Testing infrastructure (zero test coverage currently)
- Mobile/responsive UI (fixed sidebar widths; product is desktop-only)
- Onboarding funnel tracking (step-level drop-off instrumentation)
- Non-converter exit survey (Resend trigger on trial expiry)
- Trial cohort analytics in admin (activity buckets, ghost identification)
- LinkedIn feature expansion (profile sync, outreach generation, AI headshot via FAL.ai)
- Selection criteria full feature (detection, DOCX template, level calibration)
- Email verification gate tightening (block first analysis until `email_confirmed_at` set)
- Cross-account email check (prevent new-email = new-trial exploitation)
- Chrome extension for on-page job scraping
- Re-intake flow (30-day check-in to refresh diagnostic)

---

## 7. Primary User Flow

1. Visit site → anonymous Supabase session created automatically
2. Sign up → magic link or Google OAuth → email verification gates trial access
3. Complete onboarding intake → 7-step form: role target, timeline, work rights, resume upload, optional cover letter, email, identity confirmation
4. Onboarding submitted → diagnostic report generation begins (Claude strategy + Llama execution, ~60 seconds, progress bar with commentary)
5. Diagnostic report displays → 6 collapsible sections, Skool community join overlay, "Go to Dashboard" CTA
6. First dashboard visit → diagnostic card, job feed widget, match score widget, achievement count, application count
7. Paste first job description in Match Engine → instant match analysis with score and 10-dimension breakdown
8. Click "Generate Documents" → navigates to ApplicationWorkspace with JD pre-loaded
9. Generate documents (resume, cover letter, STAR response) → output in panel with copy-to-clipboard
10. Save and track application → stored in kanban pipeline, status updated through stages
11. Optional: browse job feed, research company, prep interview answers, generate follow-up emails
12. Trial expires or user upgrades → Stripe checkout → webhook grants/revokes access automatically

---

## 8. Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite 7, TypeScript 5.9, Tailwind CSS v4, Framer Motion 12, TanStack React Query 5, React Router 7, Sonner |
| Backend | Express 5, TypeScript 5.9, Node.js, Multer, node-cron |
| Database | PostgreSQL (Railway), Prisma 6.19 ORM, pgBouncer connection pooling |
| Auth | Supabase v2 — anonymous sessions, magic link, email/password, Google OAuth |
| LLM / AI | OpenRouter API: Claude (strategy blueprints, ~$0.01–0.03/call) + Llama 3.3 70B (document execution, ~$0.001–0.005/doc); Pinecone (achievement semantic search); Serper (company research); FAL.ai (AI headshots — currently broken) |
| Email | Resend (magic links, trial reminders, Friday brief delivery) |
| Payments | Stripe (checkout sessions, webhook handling, subscription management) |
| Job Data | Adzuna API (10 curated jobs/day); Apify Client (Seek scraping — in exploration) |
| Error Monitoring | Sentry (frontend + backend, ~10% trace sample rate) |
| Analytics | Not yet deployed — PostHog/Mixpanel planned |
| Hosting | Vercel (frontend), Railway (backend + PostgreSQL) |
| CI/CD | GitHub Actions (TypeScript typecheck on push/PR) |
| File Parsing | pdf-parse (PDF), mammoth (DOCX input), docx + @react-pdf/renderer (export — not yet wired) |

**LLM pipeline (3 stages):**
1. **Strategy Blueprint** (Claude via OpenRouter): analyses JD vs profile, ranks achievements, determines document strategy; cached in-memory per user
2. **Document Execution** (Llama 3.3 70B): writes actual content following blueprint
3. **Quality Gate** (Claude, optional): checks output against rules, flags failures

---

## 9. Near-Term Roadmap (Next 1–2 Months)

**Immediate (current sprint):**
- Email verification gate — block first analysis until `email_confirmed_at` is set (blocks anonymous trial abuse)
- Cross-account email check — prevent creating a new email to get 5 more free analyses
- IP rate limit tightening on analyze endpoint
- Google OAuth as primary auth option (harder to abuse than magic links to temp email)

**Before 50+ paying users:**
- Document feedback UI — stars + weak section dropdown after generation, feeds `DocumentFeedback` table
- Visa-aware urgency messaging — use existing `workRights` field to tailor trial banner copy (e.g., "Your visa window is finite" for student visa users)
- Onboarding funnel instrumentation — identify drop-off at each step
- Non-converter exit survey — single-question Resend email on trial expiry
- Trial cohort analytics in admin (ghost users vs high-engagement users)
- Match score vs application rate correlation (admin query)
- Fix 11 known bugs from 2026-04-23 checklist (education extraction, professional summary length, paragraph spacing, job feed empty state, em-dash stripping, AI headshot 500 error, Friday Brief nav link)
- DOCX/PDF export — ship download buttons (critical; users cannot attach a copy-pasted resume)

**After 100+ active users:**
- Document generation gating (add `freeGenerationsUsed` counter, ~15 doc generations in trial)
- Stripe SetupIntent (require card on file for trial — holds off unless demand is high, kills 20–40% of signups)
- LinkedIn feature full build (profile sync, outreach, AI headshot)
- Selection criteria full feature (parsing, DOCX template, level calibration)

---

## 10. Known Issues, Ugly Bits, and Hacks

**Critical missing features:**
- No PDF or DOCX export. Users can copy-paste generated documents but cannot download a formatted file. This is the single biggest functional gap — job applications require an actual file attachment.
- No test coverage. Zero test files, no Vitest/Jest/Playwright configured.
- No mobile support. All sidebar widths are fixed; the product is desktop-only.
- No structured analytics. No visibility into funnel drop-off, trial cohort behavior, or conversion drivers.

**Architecture debt:**
- `ApplicationTracker.tsx` is ~83KB / ~2,500 lines — a monolith handling cards, inline editing, sorting, filtering, pipeline funnel, and action extraction. Should be split.
- `server/src/routes/profile/profile-core.ts` is ~34KB — covers experience, education, certs, skills, achievements, and jobs all in one file.
- `prompts.ts` is ~42KB — all LLM templates in one file. Adding document types or tweaking tone requires navigating the whole file.
- In-memory blueprint cache resets on every Railway deploy — silently makes first generation post-deploy slower. Needs Redis or DB persistence.

**Specific bugs (from QA checklist 2026-04-23):**
1. SkoolGate email field says "Leave blank if same as this account" but email is required — misleading copy
2. Education section on generated resume often shows "no data available" — extraction pipeline not pulling education into profile correctly
3. Professional summary on resume is too long — prompt doesn't enforce the 60–90 word cap
4. Cover letter paragraph spacing collapses — double `\n\n` not preserved in rendered output
5. Job feed shows "no jobs found" on first load instead of "building feed"
6. Follow-up email template text says "generate an AI email" — should just say "generate an email"
7. Follow-up email outputs a long AI-style letter instead of the intended 5-line template with placeholders
8. LinkedIn generation outputs have em-dashes not stripped (main generate route strips them; LinkedIn routes don't)
9. AI headshot returns 500 error — `FAL_AI_KEY` env var name mismatch on Railway
10. Friday Brief nav link still appears in sidebar (should be admin-only at `/admin`)

**Fraud / exploitation surface:**
- Clearing localStorage resets anonymous session → 5 more free analyses
- New email address = new trial (5 analyses per email)
- No card-on-file requirement during trial
- Mitigations planned: email verification gate, cross-account email check, IP rate limiting, Google OAuth prominence
