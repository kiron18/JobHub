# Landing Rework — Outcome-First, Low-Friction

**Date:** 2026-06-02
**Goal:** Lead with outcome, kill the "diagnosis" framing, and strip signup friction to near-zero.

---

## 1. Hero: outcome, outcome, outcome

Stop opening with emotion. Open with the result they want, then prove it's plausible.

**Headline (primary):**
> Land your first Australian job in 90 days.

**Sub:**
> Drop your CV. We scan it for the exact gaps costing you callbacks — and tell you what to fix. Free, no account needed.

**Button:** `Scan my CV for gaps →`

**Microcopy:** `No signup · No card · 60 seconds`

### On the guarantee
A literal "90 days or your money back" is a **claim under Australian Consumer Law** — if it's not backed by a real refund/process it's misleading and an ACCC risk. Three safe options, pick one — **this is the one decision I need from you:**

- **A — Aspirational, no promise:** "Land your first Australian job in 90 days." (timeframe as a goal, not a guarantee). Lowest risk, ship today.
- **B — Conditional guarantee:** "Follow the plan for 90 days — if you don't land an interview, we'll [refund / extend free / 1:1 review]." Needs a real fulfilment process behind it.
- **C — Social-proof flavoured:** "Most grads who use the full system land a role in under 90 days." Needs data you can defend.

Recommend **A** to ship now, move to **B** once you have a fulfilment process.

---

## 2. Kill "diagnosis" / "diagnostic"

Nobody lands wanting a "diagnosis." They want to know what's wrong with their CV. Rename everywhere to what it actually does.

| Old | New |
|---|---|
| "Run the diagnostic" | **"Scan my CV for gaps"** |
| "your 3-minute diagnosis" | **"a free CV + cover letter gap scan"** |
| "Building your diagnosis…" (loading) | **"Scanning your CV…"** |
| "personalised job readiness diagnostic" | **"your CV gap report"** |

Files to touch: `Hero.tsx`, `ValuePreview.tsx`, `FinalCTA.tsx`, `OnboardingIntake.tsx` (`StepAuth` heading, `PrimaryButton` loading label, `StepFiles`).

---

## 3. Friction kill — the real fix

### What we collect today (in order)
1. **Auth (email + password)** ← *step 0, before any value*
2. Role, city, seniority, industry, visa
3. Response pattern
4. Resume (required) + 2 optional cover letters

### What the report actually needs
From `diagnosticReport.ts`, the prompt consumes: `targetRole`, `seniority`, `industry` (+ optional city), `responsePattern`, and the resume text.

- `targetRole`, `seniority`, `industry`, `city` → **all derivable from the resume** (we already have an extraction service).
- `visaStatus` → not derivable, but it's only a soft flag. Skip or make it one optional tap later.
- `responsePattern` → **the only high-value signal not in a resume.** One tap.

### Proposed flow (minimum viable friction)
1. **Landing → "Scan my CV for gaps" → drop resume.** No account. No questions.
2. **One optional tap while it processes:** "What are you getting back?" (existing response-pattern chips — silence / rejections / interviews stall / no offers). Skippable.
3. **Derive** role / seniority / industry / city from the resume via the extraction service. Show them back as editable chips ("Targeting Senior PM in Sydney — right?") so the user can correct in one click, not fill in five fields.
4. **Show the report immediately** — or the first 1–2 sections + a locked remainder.
5. **Email gate moves to AFTER value:** "Save your full report + unlock the fixes → enter email." Now the signup is something they *want*, because they've already seen the goods.

**Net:** signup goes from a wall in front of the product to a save-action after it. Fields drop from ~6 to **1 required (resume) + 1 optional tap**.

### Build notes
- `StepAuth` (step 0) moves to *after* the report, gated on "save / unlock."
- Allow anonymous/guest submission to `/onboarding/submit`, attach to a real account on email capture.
- Resume-derived fields populate `targetRole/seniority/industry/city`; user confirms, doesn't type.
- Keep `responsePattern` as the single retained question — it's the one thing that earns its place.

*(This is a flow spec, not yet implemented. Flag the auth-deferral as the one piece that needs care — it touches `OnboardingIntake.tsx`, `onboarding.ts`, and the anonymous-user/account-linking path.)*

---

## 4. Testimonials — triage

You'll send originals. Here's the verdict on the current 7:

### ✅ Keep (read as genuine — specific, real cadence, AU spelling)
- **Jebby Joseph** — "I have got a job as a Technical BA with TAC..." → real, specific company.
- **Nithya** — "I believe the whole of your diagnostic report... It actually counselled..." → awkward-genuine, keep.
- **Diluk Chandrashekar** — "...helps me to stay focussed. The tracker feature... follow up templates..." → real, names a feature.
- **Krisheela Bhatia** — "...used it in the morning to send out applications and within 2 months landed a new role..." → real, specific outcome.
- **Kunal** — "...more structured and centered application process... land a fulltime gig." → mildly real, keep.

### ❌ Obviously fake (markety cadence, mirrors our own landing copy, initial-only names)
- **Daniel K.** — "The most useful career tool I've ever paid for. And honestly the free diagnostic alone is worth more than half the courses I've taken." → reads like ad copy.
- **Tomás V.** — "It's like having a friend who happens to be a career coach. No fluff. No upsells." → literally echoes our own taglines.

**Action:** cut Daniel K. and Tomás V., replace with your originals. Once renamed away from "diagnostic," update Nithya's quote wording if it still says "diagnostic report."

---

## 5. Hero image of you (founder)
Pending your input — you'll supply a photo / direction. Slot: replaces the current `hero-image-t.webp` ("Aussie Grad Careers"–branded) journey strip. Will need: founder image + the on-image copy/elements you want layered.

---

## Open decision for you
**Section 1 — guarantee wording: A, B, or C?** Everything else above I can execute on your go.
