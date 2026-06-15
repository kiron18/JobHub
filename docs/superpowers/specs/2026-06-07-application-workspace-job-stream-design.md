# Application Workspace — Preloaded Job Stream → Apply Loop (Design Spec)

**Date:** 2026-06-07
**Status:** Approved-pending-spec-review
**Builds on:** [[project_apply_funnel_slices]], [[project_monetization_model]], [[project_apply_funnel_latency]], the account-seam slice (`docs/superpowers/specs/2026-06-06-account-seam-slice-a-design.md`).

**Honor:** [[feedback_no_em_dashes]] (NO em/en dashes in any copy or prompt), [[feedback_copy_ownership_split]] (Claude authors all copy in §8 verbatim; DeepSeek transcribes mechanics only), [[feedback_purposeful_animation]] (animation drives the next apply, never decorative), [[feedback_six_second_report]], [[feedback_dashboard_style]] (reuse the warm dashboard tokens, no new aesthetic), [[feedback_robust_over_quick]], [[feedback_deepseek_zero_latitude_plans]].

---

## 0. What this changes (read first)

Today the post-signup funnel lands on the dashboard (`StrategyHub`, route `/`) with a single scraped job preloaded into the paste box (`AnalysisHeroCard`, added in [[project_apply_funnel_latency]]). This spec **replaces that single-preload with a job stream**: the dashboard becomes an Application Workspace showing a few real, ready-to-apply jobs, each with its own Apply. The paste box and selection-criteria modules are demoted to two secondary buttons. The user applies to jobs one after another in a continuous stream.

**Founder decisions locked 2026-06-07 (do not re-litigate):**
- **Show ~3 jobs at a time**, each with Title, salary (if present), a one-line blurb, and an **Apply** button. Never show the full description on the card.
- **7-day trial by default, unlimited-feeling, with a daily safety cap.** Every new user is on the 7-day plan by default (free trial, no card until day 7). During the trial there is no trial-total cap and no mid-trial paywall. The one guardrail is a generous **daily cap of 25 applications per AEST day** (configurable), purely to bound the cost tail / scripted abuse. A normal hunter never hits it. (See [[project_monetization_model]].)
- **Apply → resume generates automatically; cover letter starts the moment the resume draft lands** (overlap, not simultaneous). Review/edit resume → Next → review/edit cover letter.
- **Downloads:** resume downloadable on the resume page, cover letter on the cover-letter page, plus a "Download both" on the cover-letter page.
- **After the cover-letter page, a prominent banner sends the user to Seek** (the scraped apply URL) to actually submit, then they **return to the Application Workspace**.
- **On return, the applied job animates out, is marked applied, and the next scraped job slides into its place** so the list stays full. Constant stream.
- **Two buttons under the list:** "Paste your own job" (the existing paste module) and "Selection criteria" (the existing SC module).

---

## 1. Current state (verified in code)

- **Dashboard:** `src/pages/StrategyHub.tsx` → `AnalysisHeroCard` holds the paste box (`textarea`, `data-process-step="paste"`), the "Apply" button (`handleAnalyse` → navigates to `/apply`), the `ApplyFeedStrip` (currently a single "Browse roles on Seek" banner, feed cards disabled), and the single-job preload effect (reads `localStorage['jobhub_preload_jd']`).
- **Apply workspace:** `src/pages/StepperWorkspace.tsx` (route `/apply`) reads `location.state.jobDescription`, auto-runs `/analyze/dual`, then generates resume + cover letter (`/generate/resume-structured`, `/generate/cover-letter-structured`). It already overlaps the two generations after gaps resolve.
- **Jobs data:** `JobFeedItem` rows per user (`userId`, `feedDate`, `title`, `company`, `location`, `salary`, `description` (FULL, see §7), `sourceUrl` (the Seek apply link), `sourcePlatform`, `postedAt`, `matchScore`, `isRead`, `bullets`). Written by `cv-scan/claim` (`server/src/routes/cv-scan.ts`) and `buildDailyFeed` (`server/src/services/jobFeed.ts`).
- **Feed read:** `GET /job-feed/feed?offset=0` returns today's `JobFeedItem`s (ordered by matchScore, postedAt, createdAt) and enriches each with `applicationStatus` matched by `sourceUrl`. `POST /job-feed/:id/mark-applied` exists.
- **Applied state of truth:** `JobApplication` (`userId`, `sourceUrl`, `status: ApplicationStatus @default(SAVED)`, `companyIntel`). The feed matches a `JobFeedItem` to an application by `sourceUrl`.
- **Scraper:** `server/src/services/seekScraper.ts` `mapSeekResult` already maps `description` from `item.content.unEditedContent` (full posting, stripped of HTML) and `sourceUrl` from `item.jobLink ?? item.applyLink`. Apify input uses `fullScrape: true`. So the full description + apply link are already captured and stored uncut.
- **Quota:** `server/src/middleware/accessControl.ts` has `generation: 5` (free generations) keyed to `freeGenerationsUsed`. This is the cap that currently blocks the cover letter at ~2.5 jobs.

---

## 2. End-to-end flow

```
Application Workspace (dashboard, route /)
  • 3 job cards: Title · salary? · one-line blurb · [Apply]
  • [Paste your own job]   [Selection criteria]      (secondary, side by side)
      │
      ├─ user clicks [Apply] on a card
      │     → guard: applications used < 5 ? proceed : show paywall (§6)
      │     → navigate('/apply', { state: { jobDescription: <FULL description>, company, role, sourceUrl, feedItemId, sourcePlatform } })
      │
      ▼
  /apply — Resume page
      • resume auto-generates on entry
      • the moment the resume draft lands, cover-letter generation starts (overlap)
      • user reviews / edits resume → [Download resume] available
      • [Save & continue] →
  /apply — Cover letter page
      • cover letter is already ready (generated during resume review)
      • user reviews / edits → [Download cover letter] + [Download both]
      • PROMINENT banner: "Submit on Seek" → opens sourceUrl in a new tab
      • [Done] / [Back to my jobs] →
      ▼
  Application Workspace
      • the just-applied card plays the "Applied" beat, then animates out
      • application recorded (counts toward the 5), job marked applied
      • the next scraped job slides up into the freed slot (list stays at 3)
```

---

## 3. The Application Workspace (layout)

Restructure `AnalysisHeroCard` / `StrategyHub` so the **job stream is the hero** and the paste/SC modules become secondary entries.

**3.1 Header** (existing tokens, keep concise): eyebrow + the existing "Land Your Next Australian Role Faster" headline + a subline that now frames the stream (copy in §8.1).

**3.2 Job list (hero).** Render up to **3** `JobFeedItem`s as cards. Card contents:
- **Title** (bold, primary).
- **Company** · **location** (secondary line).
- **Salary** only if `salary` is present (omit the line entirely if null; never render "salary not specified").
- **One-line blurb**: a plain-text truncation of `description` to ~120 chars on one line with an ellipsis (mechanical truncation, NOT new generated copy). Full description is never shown here.
- **Source tag**: a quiet "via Seek" (from `sourcePlatform`).
- **[Apply]** button, primary style, right-aligned within the card.

Cards use the warm dashboard tokens and a slim variant of the existing `JobCard` aesthetic. No new colours.

**3.3 Secondary actions.** Below the list, two equal-width buttons side by side:
- **[Paste your own job]** → reveals/expands the existing paste box (the current `AnalysisHeroCard` textarea + Apply, unchanged behaviour).
- **[Selection criteria]** → the existing selection-criteria module (the SC path that sets `sc=1` into `/apply`).

These are visually lighter than the job cards (secondary/ghost styling) so the stream is clearly the primary path.

**3.4 Empty pool.** If there are zero un-applied scraped jobs left, hide the list and show the empty-state copy (§8.5) above the two buttons.

---

## 4. The Apply flow (resume → cover letter → Seek → return)

**4.1 Apply click.** On a card's Apply:
1. Check remaining applications (§6). If none, open the paywall instead of navigating.
2. Navigate to `/apply` with `state = { jobDescription: <full JobFeedItem.description>, company: <JobFeedItem.company>, role: <JobFeedItem.title>, sourceUrl, feedItemId: <JobFeedItem.id>, sourcePlatform }`. The full description (not the blurb) is passed so generation has the complete posting.
3. **JD-completeness fallback:** if `description` is empty or under a minimum length (e.g. < 200 chars), fetch the full posting from `sourceUrl` before generating (Option B fallback). This is rare for Seek (`fullScrape`), so it is a guard, not the default path. Mechanics in the plan.

**4.2 Generation overlap.** Keep StepperWorkspace's existing behaviour: resume generates first and renders; cover-letter generation begins as soon as the resume draft lands (it already runs after gaps resolve and `intelSettled`). Do NOT fire both simultaneously on entry. The cover letter should be ready by the time the user finishes reviewing the resume.

**4.3 Downloads.** Resume page: a "Download resume" action. Cover-letter page: "Download cover letter" and "Download both". (Reuse existing export; "Download both" triggers both downloads.)

**4.4 Seek submission banner.** On the cover-letter page, after the draft exists, show a prominent banner (copy §8.3) with a primary CTA that opens `sourceUrl` in a new tab (`target="_blank"`, `rel="noopener noreferrer"`). This is the "now actually submit" step.

**4.5 Record the application + return.** A single "Done" / "Back to my jobs" action on the cover-letter page:
1. Records the application as applied for this `sourceUrl` (creates/updates the `JobApplication` row to applied status via the existing mark-applied mechanism). This is the source of truth for both the quota count and the stream.
2. Navigates back to the Application Workspace.

The application is recorded on this explicit completion, NOT on the Seek-link click (the user may open Seek then come back to edit). The plan defines the exact endpoint and status value.

---

## 5. Applied animation + refill stream

On return to the Application Workspace, the just-completed job (matched by `sourceUrl` / `feedItemId`) plays a short, purposeful beat then leaves, and a fresh job takes its slot.

**5.1 Sequence:**
1. The matching card shows an **"Applied" confirmation state** (a check + the word "Applied", §8.4) for ~1.2s. This is the "boom, done" signal.
2. The card animates out (collapse + fade, Framer Motion, eased), the list shifts up.
3. The next un-applied scraped job slides into the freed slot, so the visible count returns to 3.

**5.2 Mechanics:** the workspace knows which `sourceUrl`/`feedItemId` was just applied (passed back via navigation state or read from the refreshed feed where `applicationStatus` is now applied). The visible list = the first 3 `JobFeedItem`s whose `applicationStatus` is not applied. Applied jobs are excluded from the stream permanently. Animation is keyed so only the just-applied card animates out (not a full re-render flash).

**5.3 Purposeful, not decorative** ([[feedback_purposeful_animation]]): the beat exists to confirm progress and pull the eye to the next job. Keep it under ~1.5s total. No confetti loops, no idle motion.

**5.4 Momentum signal:** alongside the applied beat, surface a positive running count of applications sent (copy §8.4), e.g. "3 applications sent". This is momentum, NOT a countdown to a cap (there is no cap during the trial, §6).

---

## 6. The 7-day trial: unlimited-feeling, daily safety cap

**6.1 Trial by default, abundant by design.** Every new user is on the 7-day plan by default (no card until day 7). No trial-total cap, no mid-trial paywall. The apply loop should feel abundant; the product's job is to build the habit each day to convert at day 7.

**6.2 The one guardrail: 25 applications / AEST day (configurable).** One application = one Apply action that generates a resume + cover letter pair for a job (~$0.10 to $0.12 each, ~$3/day, ~$21/week worst case, founder-approved 2026-06-07). The cap **resets daily** so a heavy day never locks the user out for the rest of the trial. **Regenerating** an existing job's documents does NOT count as a new application; regenerate abuse is bounded by a per-minute rate limit on the generation endpoints. The cap is a single config constant (`DAILY_APPLICATION_CAP = 25`) so it can be tuned without logic changes.

**6.3 Where it is enforced.**
- **Apply guard (§4.1):** on Apply click, count the user's applications created today (AEST). If `>= DAILY_APPLICATION_CAP`, show the daily-cap message (§8.6) and do NOT navigate. Otherwise create the `JobApplication` row (this both counts toward the cap and seeds the §4.5 completion/stream state) and navigate.
- **Stop the double-gate:** the existing `checkAccess(userId, 'generation', ...)` cap (`accessControl.ts`, `generation: 5`) must be lifted for active-trial users so generation never blocks within the day's allowance. Recommended seam: treat an active-trial user as unlimited generations at the access layer.

**6.4 Instrumentation.** Log per-application LLM cost so the real distribution is visible and the cap can be tuned with data ([[project_monetization_model]] keeps the gate movable by design).

**6.5 Conversion happens at day 7, elsewhere.** The day-7 conversion / educational drip is owned by the broader monetization flow, not this workspace.

---

## 7. Data: capture everything, show a blur

**7.1 Already captured.** The Seek scraper stores the FULL description (`content.unEditedContent`) and the apply link (`sourceUrl`). `JobFeedItem` persists them uncut. No change needed to capture more from Seek.

**7.2 Hardening (plan):**
- Confirm `cv-scan/claim` and `buildDailyFeed` persist the full `description` and `sourceUrl` without truncation (they do today; the plan adds a guard/test).
- For non-Seek sources or empty descriptions, the §4.1 fetch-on-apply fallback hydrates the full posting before generation.

**7.3 Display rule.** The card shows only Title, company/location, salary (if present), and a ~120-char one-line blurb. The full text is reserved for generation. Never overwhelm the card.

---

## 8. Copy (locked, Claude-owned, em-dash-free)

Render verbatim. `{role}` etc. are runtime values. No em or en dashes anywhere.

**8.1 Workspace subline (under the headline):**
> Real roles we found for you, ready to apply to in minutes. Pick one and we will tailor your resume and cover letter.

**8.2 Card + primary actions:**
- Apply button: `Apply`
- Salary present: render the value as-is. Salary absent: omit the line.
- Source tag: `via Seek`
- Secondary buttons: `Paste your own job` and `Selection criteria`

**8.3 Seek submission banner (cover-letter page):**
- Heading: `Last step: submit on Seek`
- Body: `Download your resume and cover letter, then submit them on the live listing. We open it for you in a new tab.`
- CTA: `Submit on Seek`

**8.4 Applied beat + momentum:**
- Card confirmation: `Applied`
- Momentum line (positive running count, no cap): `{n} applications sent`
- Optional toast on return: `Applied. On to the next one.`

**8.5 Empty pool:**
- Heading: `That is every fresh match for now.`
- Body: `Paste your own job below, or check back soon for new roles.`

**8.6 Daily cap reached (encouraging, not a paywall):**
- Heading: `That is 25 applications today. Serious effort.`
- Body: `Come back tomorrow for a fresh batch. Your trial keeps running, and the more you apply, the sooner the callbacks start.`
(No upgrade CTA here; the trial continues. Day-7 conversion is handled by the monetization flow.)

**8.7 Download actions:**
- Resume page: `Download resume`
- Cover-letter page: `Download cover letter` and `Download both`

---

## 9. Non-goals / out of scope

- No change to the resume/cover-letter generation prompts (handled separately).
- No re-enabling of LinkedIn/Adzuna sources (env-disabled); the stream is Seek-fed for now.
- No match-score UI on the cards (kept simple per §3.2).
- No editing of the scraped job inside the workspace (Apply uses the stored full description; the user edits documents, not the listing).

---

## 10. Open questions for the plan

1. **Trial recognition + cap enforcement (§6.2/6.3):** confirm how an active 7-day-trial user is recognised (`planStatus === 'trialing'` within `trialEndDate`?) so (a) generation is uncapped for them and (b) the daily 25-application cap is enforced at the Apply layer. Recommend: trial-aware `accessControl` (uncapped generations for trial) + a `countTodaysApplications(userId)` check on Apply.
2. **Application record timing (§4.5):** confirm the endpoint + `ApplicationStatus` value used to mark applied (reuse `POST /job-feed/:id/mark-applied` if it sets the right status and creates the row). Used only to drive the stream/animation now, not a quota.
3. **Stream refill source:** all of today's un-applied `JobFeedItem`s (we scrape ~80), newest-first, excluding applied. Confirm ordering preference (matchScore is mostly null on claim-written rows, so postedAt/createdAt governs).
