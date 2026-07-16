# AGC System Overview

> Written 2026-07-15. One map of the three AntiGravity projects, how they connect,
> and the plan for the Pulse command center. Identical copies live at the root of
> all three repos; if you edit one, re-copy it to the others.

## The three systems

### 1. JobHub (`E:\AntiGravity\JobHub`)
The product. Web app students use to apply consistently, with AI resume/cover generation.

- **Stack:** React/Vite client, Express + TypeScript + Prisma server, PostgreSQL.
- **Deployed:** frontend on Vercel, backend on Railway (`server/railway.json`).
- **Student data (Prisma):** `CandidateProfile` (email, goals, goal types), `JobApplication`, `OutreachLog`, `GoalChange`, `PauseWeek`, `NudgeLog`, `DiagnosticReport`, `Document`, plus its own email/CRM tables (`Contact`, `EmailSequence`, `EmailSend`).
- **The key endpoint for the command center already exists:** `GET /api/admin/coach/overview` (`server/src/routes/coach.ts`). Returns one row per member: this week's applications and outreach vs their goals, streak, last 4 completed weeks (12 tracked), pause weeks, goal-change history, and backdating flags. Auth: JWT (`authenticate`) plus admin email allowlist (`EXEMPT_EMAILS` from `stripe.ts`).
- Related: `leaderboard.ts`, `skool.ts` (join), `stripe.ts` (payment onboarding, Phase 1 of the JobHub-CRM bridge).

### 2. Daekwon (`E:\AntiGravity\Daekwon`)
Two products sharing a repo:

- **CRM Lead Board** (`crm/`, Python stdlib server on `http://localhost:8765`). Source of truth is Obsidian lead notes (markdown files); the server reads/writes them. Tracks LinkedIn leads through accept, message, follow-up, pitch, client stages. Runs locally, autostarts via `crm\launch_crm.bat`.
- **Pulse** (`http://localhost:8765/pulse`, `crm/metrics.py` + `crm/static/pulse.html`). Aggregates three sources: lead notes (always available), Resend (email outcomes), PostHog (receipts-page visits). Slow sources cached 10 minutes; `?fresh=1` refetches. Currently outreach-focused; no student/JobHub data yet.
- **Hermes agent** (Telegram, runtime at `C:\Users\Kiron\AppData\Local\hermes`). Documented in `SYSTEM_OVERVIEW.md` in this repo (2026-06-22). **Decision 2026-07-15: unreliable and expensive, so it is out of the critical path.** Nothing in the command center depends on it.

### 3. agc-content-engine (`E:\AntiGravity\agc-content-engine`)
Programmatic content production: `ContentPayload.json` in, carousel PNGs (Puppeteer), short-form video (Remotion), and captions out.

- **No server.** Batch renderers run via `npm run generate:carousel` / `generate:video`; output lands in `output/`.
- Pulls design tokens and illustrations from the JobHub repo via `npm run copy-assets` (a local-path dependency on `E:/AntiGravity/JobHub`).
- No per-lead or per-student engagement tracking today.

## How they connect

- **Join key: student email.** JobHub `CandidateProfile.email` matches the CRM lead/client notes.
- **Pull direction: Daekwon pulls from JobHub prod.** Prod (Railway) cannot reach localhost, so all sync code lives on the Daekwon side and calls the deployed JobHub API.
- Content engine's only link is the local asset copy from JobHub; no runtime integration yet.

## The plan: Pulse becomes the command center

Decided 2026-07-15. Metrics stay; an intelligence layer adds per-student analysis next to them. The Hermes agent is not involved. Workflow is **advise, then Kiron's input, then draft**: the system recommends and explains, Kiron reacts, and only then is a message drafted.

- **Phase 1, sync (no LLM):** a fetcher in `crm/` pulls `GET /api/admin/coach/overview` from the Railway backend and merges it with lead/client notes by email into one snapshot object per student, cached on disk. Deterministic and free.
- **Phase 2, intelligence (one API call):** a single batched Claude API call per refresh (daily cron plus a manual refresh button on Pulse, never per page load). Input: all snapshots plus the coaching rules (90-day syllabus, level gates, First Blood rule, goal floors). Output: structured JSON per student with status read, flag level, recommended action, and the why. Cached with a timestamp; Pulse just renders it.
- **Phase 3, later:** content engine joins the snapshot once it tracks engagement; more sources as needed.

## Can the content engine be deployed as-is?

It is a batch renderer, not a service, so "deploy" means giving it a place to run headless. Remotion and Puppeteer both run fine on a Linux box (Chrome deps plus decent CPU), and Remotion also offers Lambda rendering for scale. Two things block hosting it unchanged: the asset sync reads `E:/AntiGravity/JobHub` by local path, and there is no HTTP or queue wrapper around the npm scripts. Recommendation: keep it local for now and wrap `npm run generate:*` in a small script the CRM server can invoke; revisit hosting (Remotion Lambda or a Railway worker) when content volume justifies it.

## Open items

1. **Auth for the Phase 1 pull:** either mint a long-lived coach JWT for the fetcher or add a service API key check to the coach routes (small JobHub change; the service key is cleaner).
2. **Anthropic API key location** for the Pulse intelligence call: `~/.hermes/.env` is already the pattern `metrics.py` uses for Resend/PostHog keys.
3. **Email consistency audit:** confirm each paying student's JobHub account email matches their CRM note before trusting the join.
4. Daekwon's `SYSTEM_OVERVIEW.md` (2026-06-22) remains the reference for Hermes runtime internals; this doc supersedes it for cross-project architecture.
