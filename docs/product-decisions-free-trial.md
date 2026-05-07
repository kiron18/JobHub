# Free Trial, Gating & Fraud — Product Decisions

*For evaluation by Kiron — not yet implemented*

---

## 1. What 5 Free Analyses Actually Cost You

**Model:** `meta-llama/llama-3.3-70b-instruct` via OpenRouter  
**Pricing:** $0.12 / M input tokens · $0.30 / M output tokens

### Per job analysis (POST `/job`)
The prompt includes the full job description, entire candidate profile, achievements context, and scoring instructions.

| Component | Est. tokens |
|---|---|
| JD + profile + achievements (input) | ~6,000 |
| Analysis JSON response (output) | ~3,000 |
| **Cost per analysis** | **~$0.0016** |

**5 analyses = ~$0.008 per user. Less than one cent.**

### Per document generation (POST `/generate/:type`)
The generation prompt includes the JD, profile, rule book for the document type, and the analysis blueprint.

| Component | Est. tokens |
|---|---|
| Input (JD + profile + rules + blueprint) | ~10,000 |
| Output (cover letter / resume / criteria) | ~2,000 |
| **Cost per document** | **~$0.003** |

**A user who runs 5 analyses and generates 3 documents per job (15 total) costs ~$0.053 — about 5 cents.**

### Diagnostic report (onboarding)
Uses `callLLMWithRetry` (same Llama model). One report per user on signup.  
Est. cost: ~$0.003–$0.006 per new user.

### Verdict
The cost exposure from a free trial is negligible per user. The real risk is **volume exploitation** — someone writing a script that creates thousands of accounts — not individual casual abuse. That said, being deliberate about this now prevents headaches later.

---

## 2. Gating Document Generation — Overview

### Current state
- `freeJobsUsed` counter gates **job analysis only** (`POST /analyze/job`)
- Document generation (`POST /generate/:type`) is **completely ungated** — any authenticated user can generate unlimited cover letters, resumes, etc.
- A user who runs 1 analysis can then generate 100 documents off that one analysis indefinitely

### Options

#### Option A — Keep generation free, gate analysis only *(current)*
**Rationale:** Generation without a fresh analysis is lower value. The AI needs current, matched context to produce good output. Unlimited generation off a stale analysis degrades quickly.  
**Risk:** Low. A determined user could get reasonable documents off 5 analyses. At $0.003/doc this costs you money but not much.  
**Verdict:** Acceptable for now. Revisit when you have >100 active users.

#### Option B — Tie generation count to subscriptions *(recommended for v2)*
- Free trial: 5 analyses + 15 document generations total
- Paid: unlimited
- **Effort:** Medium (2–3 hours). Add `freeGenerationsUsed` column to `CandidateProfile`, increment in `generate.ts`, add guard same as analyze.ts. No schema migration complexity — just a new int column.
- **Risk of breaking things:** Low if done carefully. The guard is the same pattern as the analysis gate.

#### Option C — Hard cap: one document type per analysis *(over-engineered for now)*
Track which document types have been generated per job application. Gate per combo. Complex, fragile, bad UX. Skip this.

### Recommendation
**Do Option A now, plan Option B for when you hit 50+ paying users.** The current exposure is ~$0.003/doc. Even 1,000 abusive generations = $3. Not worth the friction of gating before you have product-market fit.

**If you want to implement Option B now, it is about 2–3 hours of clean work with no breaking changes.**

---

## 3. Welcome Modal — Workspace First-Time Entry

### Proposed content

When a user navigates from the diagnostic to the dashboard for the first time (`hasCompletedOnboarding` just became true), show a modal:

**Headline:** "You get 5 free runs. Make them count."

**Body copy:**
> JobHub has built everything you need to go from "applying and hearing nothing" to "interview booked."
>
> Here's what you can do right now:
>
> - **Paste any job ad** → get a match score, keyword gaps, and ranked achievements in seconds
> - **Generate a tailored cover letter** → written around the specific role, not a template
> - **Generate a targeted resume** → your experience reframed for each application
> - **Track applications** → know exactly where every opportunity is in the pipeline
> - **Email templates** → follow-up, cold outreach, post-interview thank you
>
> **One thing to know:** The AI is good, not perfect. Always read what it produces before sending. A bad cover letter sent is worse than no cover letter. Give it a quick read and personalise the intro.
>
> **You have 5 free job analyses.** Each one generates unlimited documents for that role. Start with the job you want most.

**CTA:** "Got it — let's go →"

**Trigger logic:** Show once, on first dashboard visit after `hasCompletedOnboarding`. Store `hasSeenWorkspaceIntro` in localStorage. Do not show again.

### Effort: ~1.5 hours

---

## 4. "Go to Dashboard" Button — After Diagnosis

### Current state
Plain button at the bottom of the report. Low urgency, no copy.

### Proposed redesign

Above the button, add a section:

**Eyebrow (small caps, teal):** YOUR NEXT MOVE

**Headline:** "Your report is only half the battle."

**Body:**
> The diagnosis tells you what's wrong. The workspace fixes it.
>
> Paste the job ad you want most — JobHub will match your achievements to it, write the cover letter, and tailor your resume. The whole thing takes under 5 minutes and costs you nothing to try.
>
> **You have 5 free runs. Use the first one today.**

**Button (full-width, teal gradient, large):** "Try the workspace — it's free →"

**Subtext below button:** No credit card required for your first 5 analyses.

### Psychological levers used
- **Urgency without pressure** — "use the first one today" anchors action to now
- **Loss aversion** — "only half the battle" frames inaction as leaving value on the table
- **Specificity** — "under 5 minutes" removes the "this will take ages" objection
- **Risk removal** — "costs you nothing to try" + "no credit card" kills the last objection

### Effort: ~45 minutes (copy + styling only, no logic changes)

---

## 5. Fake Email Exploitation — Threat Assessment & Fixes

### How the current system works
1. New visitor → anonymous Supabase session created automatically
2. User completes onboarding and gets a diagnostic (costs you ~$0.004)
3. User connects email via magic link or Google OAuth
4. `freeJobsUsed` counter starts at 0 on their profile

### Exploitation vectors

**Vector 1: Fresh anonymous session**  
Clear localStorage → new anonymous session → new profile → 5 more free analyses. Repeat.  
**Ease:** Easy. Anyone who knows developer tools can do it.  
**Cost per loop:** ~$0.008 (5 analyses) + $0.004 (diagnostic) = ~$0.012

**Vector 2: New email address**  
Create a new Gmail/Outlook → sign up → 5 more analyses.  
**Ease:** Moderate. Requires actually creating an email.  
**Cost per loop:** Same as above.

**Vector 3: Scripted abuse**  
Automated account creation at volume.  
**Ease:** Hard without a proxy pool. Your current setup with Supabase anonymous auth makes this feasible but not trivial.  
**Cost risk:** High if volume. 10,000 automated accounts = ~$120.

### Recommended fixes (in priority order)

#### Fix 1 — Require email verification before granting free trial *(most important)*
Currently users get free analyses before verifying their email. Flip this:
- User completes onboarding → diagnostic is shown (no cost issue here, it's one per user)
- Before the **first job analysis**, check if `email` is verified (Supabase sets `email_confirmed_at`)
- If not verified, show: "Verify your email to unlock your 5 free analyses"
- After verification, grant trial

**Effect:** Eliminates anonymous session abuse entirely. Requires a real email per trial block.  
**Effort:** ~2 hours. Add a check in `analyze.ts` for `email_confirmed_at` via the Supabase admin API.

#### Fix 2 — Tie trial to email across accounts *(closes the new-email vector)*
Before granting a free analysis, query: has any profile with this email address ever had `freeJobsUsed > 0`?  
If yes, deny the trial and prompt to subscribe.

**Effect:** Closes the "new email = new trial" loophole. A real person can only do this a few times before it becomes effort.  
**Effort:** ~1 hour. One extra query in `analyze.ts`.

#### Fix 3 — Rate limit by IP *(quick deterrent)*
Already have `analyzeRateLimit` middleware. Tighten it to 5 requests per IP per 24 hours on the analyze route.

**Effect:** Crude but blocks scripted abuse without proxies.  
**Effort:** 30 minutes — just change the rate limit config.

#### Fix 4 — Prefer Google OAuth, soft-discourage magic link *(longer term)*
Google accounts are tied to real identities with phone verification. Magic links to temp-mail.org etc. are trivially generated.  
Make Google OAuth the prominent option, move magic link to secondary.

**Effect:** Significantly raises the cost of abuse. Most casual exploiters won't bother creating a new Google account.  
**Effort:** UI-only change, ~30 minutes.

#### Fix 5 — Stripe SetupIntent for free trial *(nuclear option — not recommended yet)*
Require a card on file (no charge) before granting the trial. Standard SaaS practice.  
**Effect:** Virtually eliminates abuse. Also drops conversion by 20–40% (industry data).  
**Do this only when you have enough organic demand that conversion rate matters more than volume.**

### Recommended immediate actions
1. **Fix 3 now** — tighten the IP rate limit (30 min, low risk)
2. **Fix 1 after next deploy** — email verification gate before first analysis (2 hrs, high impact)
3. **Fix 2 alongside Fix 1** — cross-account email check (1 hr)
4. **Fix 4 as a UI polish** — Google OAuth prominence (30 min)

At your current stage (pre-scale), Fixes 1–3 are sufficient. Fix 5 is premature.

---

## Summary — What to Build and When

| Item | Effort | When |
|---|---|---|
| Welcome modal (workspace intro) | 1.5 hrs | Now |
| Improved "go to dashboard" CTA | 45 min | Now |
| Email verification gate on trial | 2 hrs | Next deploy |
| Cross-account email check | 1 hr | Next deploy |
| IP rate limit tighten | 30 min | Now |
| Google OAuth prominence | 30 min | Now |
| Gate document generation (Option B) | 2–3 hrs | When 50+ paying users |
