# Auth, Visa Status & Citizenship Alert — Design Spec

**Date:** 2026-04-09
**Status:** Approved

---

## Problem

1. **Broken auth loop.** Onboarding collects email at the end and calls `supabase.auth.updateUser({ email })` to upgrade an anonymous session. This requires email confirmation that never completes, leaving users with orphaned anonymous accounts. Every return visit creates a new Supabase user and forces a full re-onboarding.

2. **No visa/work-rights awareness.** The backend detects `requiresCitizenship: true` on job descriptions but has no knowledge of the user's work rights. Users without Australian citizenship waste effort on hard-blocked roles.

---

## Solution Overview

- Move account creation to the **end** of onboarding (Approach A: defer submission until after auth).
- Add a **visa status question** to Step 1 of the intake form.
- Add a **citizenship warning modal** in the match engine when a job requires citizenship and the user is not an Australian Citizen.
- Update the returning-user **login page** to use email+password and Google OAuth only (remove magic link).

---

## Onboarding Flow (New)

```
Step 0  Welcome
Step 1  Role + Visa Status        ← visa status added here
Step 2  Timeline
Step 3  Responses
Step 4  Files + Marketing Consent ← email field removed
Step 5  Create Account            ← NEW: email+password or Google OAuth
Step 6  Processing Screen
```

All answers remain in React component state throughout Steps 0–4. No Supabase session exists yet (no anonymous session created). On Step 5, the user creates a real account. Only after successful auth does `POST /onboarding/submit` fire with the real JWT.

---

## Step 1 — Visa Status Field

Added as the last field on the existing Role step (`StepRole`). Single-select, required before advancing.

**Label:** "What are your work rights in Australia?"

**Options:**
- Australian Citizen
- Permanent Resident
- Skilled Visa (482 / 186 / 189 / 190)
- Working Holiday Visa
- Student Visa
- Other / Not specified

Stored in `IntakeAnswers.visaStatus: string`.

---

## Step 5 — Create Account (New Step)

Inserted between Step 4 (Files) and Step 6 (Processing). Replaces the email field that was previously in Step 4.

**Heading:** "Last step — create your account"

**Sub-copy:** "Your diagnosis report will be sent to this email. Use one you actually check — we don't send spam."

**Auth options:**
1. Email + password (signup form: email field + password field, min 8 chars)
2. "Continue with Google" button → `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/onboarding-return' } })`

**Google OAuth redirect handling:**
- Before triggering OAuth: serialise text answers to `localStorage` (`jobhub_pending_onboarding`); persist File objects (resume, cover letters) to **IndexedDB** (`jobhub_pending_files`) — localStorage cannot store binary data.
- Supabase redirects back to `window.location.origin` (root `/`). `OnboardingGate` runs on every authenticated load. If `jobhub_pending_onboarding` exists in localStorage AND the user has no completed profile, `OnboardingGate` renders `OnboardingIntake` in "resume" mode — skipping directly to the submit step and auto-firing `POST /onboarding/submit` after retrieving files from IndexedDB.
- Clear both `jobhub_pending_onboarding` and IndexedDB entries after successful submission.
- **Trade-off:** Google OAuth uses whichever Google account is active in the browser, which may not be the email the user wants their report sent to. The auth step copy should note: *"With Google, your report goes to your Google account email."*

**On successful email+password signup:**
- Call `POST /onboarding/submit` with the authenticated session JWT.
- Advance to Step 6 (ProcessingScreen).

**Error states:**
- Email already registered → show "This email already has an account. Sign in instead." with a link to `/auth`.
- Weak password → inline validation before submit.
- OAuth failure → toast error, stay on Step 5.

**Marketing consent checkbox** remains on Step 4 (Files), not moved.

---

## Returning User Login (`/auth`)

Replace current magic-link-first layout.

**Options:**
1. Email + password (sign in / sign up toggle, same as today's password mode)
2. "Continue with Google" button

Magic link removed as a default auth method. If password reset is needed in future, add a "Forgot password?" link triggering Supabase's built-in reset email.

The `hintEmail` / auto-send magic link behaviour (triggered when redirected from `ProtectedRoute`) is also removed — it relied on the broken anonymous+updateUser flow.

---

## Citizenship Warning Modal

### Trigger condition

`POST /analyze/job` response includes a new field:

```ts
citizenshipWarning: boolean
// true when: australianFlags.requiresCitizenship === true
//            AND profile.visaStatus !== 'Australian Citizen'
```

Computed server-side in `analyze.ts`. Frontend reads this field after analysis completes.

### Modal behaviour

Shown immediately after analysis, before displaying results. Same hard-warning pattern as `LowMatchWarning`.

**Copy:**

> **This role requires Australian citizenship.**
>
> Citizenship requirements are hard boundaries. Regardless of your qualifications or experience, applications from non-citizens are rejected at the screening stage. Your time is better spent on roles open to your visa status.

**Actions:**
- "Find a better role" (primary, closes modal, stays on match engine)
- "Proceed anyway — I understand" (muted small text, dismisses modal, shows results as normal)

### Frontend type change

```ts
// AnalysisResult (MatchEngine.tsx)
citizenshipWarning?: boolean;
```

### Note on Permanent Residents

PR holders are also flagged. Most Australian Government citizenship-required roles (APS, Defence, security clearance) do not accept PRs. If this proves too aggressive in practice, PR can be excluded from the trigger condition in a follow-up.

---

## Data Model Changes

### Frontend — `IntakeAnswers`

```ts
visaStatus: string; // added
```

### Backend — `POST /onboarding/submit`

Receives `visaStatus` in the `answers` JSON body. Stores on the user's profile record.

### Database — `Profile` table

```prisma
visaStatus  String?
```

New nullable column — existing users are unaffected (defaults to null, treated as "not specified").

Migration: `prisma migrate dev --name add_visa_status`.

### Backend — `POST /analyze/job`

After computing `australianFlags`, fetch `profile.visaStatus` for the authenticated user. Add to response:

```ts
citizenshipWarning: australianFlags.requiresCitizenship && profile.visaStatus !== 'Australian Citizen'
```

If `visaStatus` is null (pre-existing users who haven't re-onboarded), `citizenshipWarning` is `false` — no false positives for existing users.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/OnboardingIntake.tsx` | Add `visaStatus` to `IntakeAnswers`; add field to `StepRole`; add `StepAuth` component; update `STEPS` array; remove email/`updateUser` logic; persist answers to localStorage before Google redirect |
| `src/pages/AuthPage.tsx` | Remove magic link mode; add Google OAuth button; remove hint-email auto-send |
| `src/components/MatchEngine.tsx` | Add `citizenshipWarning` to `AnalysisResult`; render `CitizenshipWarning` modal when flag is true |
| `server/src/routes/onboarding.ts` | Accept and store `visaStatus` from submitted answers |
| `server/src/routes/analyze.ts` | Fetch `profile.visaStatus`; compute and return `citizenshipWarning` |
| `server/prisma/schema.prisma` | Add `visaStatus String?` to `Profile` model |
| New migration | `add_visa_status` |

---

## Out of Scope

- Password reset flow (can be added later as "Forgot password?" on `/auth`)
- Magic link as a fallback login method
- Showing visa-status-aware filtering in the tracker or document library
- Updating `visaStatus` after onboarding (profile settings page, future work)
