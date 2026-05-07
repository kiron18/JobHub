# Payments & Free Tier — Testing Guide

This document covers every scenario in the subscription system and how to test each one manually. No code changes needed — all testing uses the Stripe dashboard, Supabase SQL editor, and the live app.

---

## Prerequisites

**Stripe test mode**
All three prices were created in your Stripe account. Before testing, confirm the Stripe dashboard is in **Test mode** (toggle in the top-left). The price IDs in `server/.env` must match test-mode prices, not live prices.

**Test card numbers (Stripe universal)**
| Scenario | Card number | Expiry | CVC |
|---|---|---|---|
| Payment succeeds | `4242 4242 4242 4242` | Any future date | Any |
| Trial succeeds, then charge fails | `4000 0000 0000 3220` (3DS) — or set up via Stripe CLI | — | — |
| Card declined immediately | `4000 0000 0000 0002` | Any future date | Any |

**Stripe CLI (optional but recommended for webhook testing)**
Install from: https://stripe.com/docs/stripe-cli
Then run: `stripe login` and `stripe listen --forward-to localhost:3002/api/stripe/webhook`

**Supabase SQL editor**
Used to inspect and reset database state. Open your Supabase project → SQL Editor.

---

## 1. Check your own account state

Run this in the Supabase SQL editor (replace the email):

```sql
SELECT
  "userId", email, plan, "planStatus",
  "trialEndDate", "accessExpiresAt",
  "freeGenerationsUsed", "freeAnalysesUsed",
  "freeJobSearchesUsed", "freeMatchScoresUsed",
  "stripeCustomerId", "stripeSubscriptionId"
FROM "CandidateProfile"
WHERE email = 'your@email.com';
```

Your own email (`kiron182@gmail.com`) is in the exempt list — the access control middleware will always return `allowed: true` for it, regardless of plan. Use a **different test account** for all free tier and payment tests.

---

## 2. Create a test account

1. Open the app in an incognito window (or a different browser)
2. The app will automatically create an anonymous Supabase session
3. Complete onboarding so a `CandidateProfile` row is created
4. Note the `userId` from the SQL query above using the anonymous user's email (it will be null initially — query by `userId` instead once you find it)

Find the anonymous user:
```sql
SELECT "userId", email, plan, "planStatus", "freeGenerationsUsed"
FROM "CandidateProfile"
ORDER BY "createdAt" DESC
LIMIT 5;
```

---

## 3. Free tier limits

### What the system does
- 5 document generations (lifetime, never reset)
- 5 job analyses (lifetime, never reset)
- 1 job feed search (triggers the first feed build only)
- 1 match score

### How to test free tier blocking

**Step 1 — Max out a counter via SQL (faster than clicking 5 times)**

```sql
-- Max out document generations
UPDATE "CandidateProfile"
SET "freeGenerationsUsed" = 5
WHERE "userId" = 'paste-test-user-id-here';

-- Max out analyses
UPDATE "CandidateProfile"
SET "freeAnalysesUsed" = 5
WHERE "userId" = 'paste-test-user-id-here';
```

**Step 2 — Try to generate a document**
- Go to Application Workspace → paste any job description → click Generate Cover Letter
- Expected: API returns HTTP 402 → upgrade modal should appear (if wired to that button)
- If the modal doesn't appear yet, check Railway logs for: `Generation limit reached`

**Step 3 — Verify the counter increments correctly**
Reset one counter and try generating once:

```sql
UPDATE "CandidateProfile"
SET "freeGenerationsUsed" = 4
WHERE "userId" = 'paste-test-user-id-here';
```

Generate one document → counter should now be 5 → next attempt blocked.

**Step 4 — Job feed search**
The job search counter only increments when a fresh feed build is triggered (i.e., there are 0 jobs for today). If you already have jobs in the feed, no counter is charged on page reload.

```sql
-- Check if jobs exist for today
SELECT COUNT(*) FROM "JobFeedItem"
WHERE "userId" = 'paste-test-user-id-here'
AND "feedDate" = CURRENT_DATE;
```

To test blocking, max the counter:
```sql
UPDATE "CandidateProfile"
SET "freeJobSearchesUsed" = 1
WHERE "userId" = 'paste-test-user-id-here';
```
Then delete today's jobs to force a fresh build:
```sql
DELETE FROM "JobFeedItem"
WHERE "userId" = 'paste-test-user-id-here'
AND "feedDate" = CURRENT_DATE;
```
Now visit `/jobs` — the feed should attempt to build and be blocked (Railway logs will show `402`).

**Step 5 — Reset for next test**
```sql
UPDATE "CandidateProfile"
SET
  "freeGenerationsUsed" = 0,
  "freeAnalysesUsed" = 0,
  "freeJobSearchesUsed" = 0,
  "freeMatchScoresUsed" = 0
WHERE "userId" = 'paste-test-user-id-here';
```

---

## 4. Free tier banner (FreeBanner)

**What to look for:**
Log in as the test account → dashboard should show a thin banner at the top:
- "Free tier — 5 document generations · 5 analyses remaining"
- "Upgrade — from $97/mo →" button

After maxing both counters:
- Banner turns red
- Text updates to "0 document generations · 0 analyses remaining"

Clicking "Upgrade — from $97/mo →" goes straight to the 3-Month Bundle checkout (hardcoded in `FreeBanner`).

---

## 5. Upgrade modal

The modal is triggered by any component calling `showUpgradeModal(trigger)` — or by a 402 response from the API.

**Trigger it manually from the browser console:**
```javascript
window.dispatchEvent(new CustomEvent('show-upgrade', { detail: 'generation' }))
```

Other trigger values: `'analysis'`, `'job_search'`, `'match_score'`

**What to verify:**
- Modal appears with 3 plan cards
- Monthly shows "7-day free trial"
- 3-Month Bundle shows "Recommended" badge, no trial copy
- Annual shows "7-day free trial"
- Clicking a plan calls `POST /api/stripe/checkout` and redirects to Stripe

---

## 6. Pricing page

Visit `/pricing` (no login required).

**Check:**
- All 3 plan cards render with correct prices
- 3-Month Bundle has "Recommended" badge
- Monthly and Annual show weekly framing (≈ $25/week, ≈ $11.50/week)
- All 4 FAQ items open/close correctly
- "Get started free →" button navigates to `/auth`
- If already logged in, "Get 3-Month Access" / "Start Free Trial" buttons initiate checkout

---

## 7. Stripe checkout — Monthly plan (7-day trial)

**Steps:**
1. Log in as test account (not your exempt email)
2. Open upgrade modal → click "Start Free Trial" on Monthly
3. Stripe Checkout page opens → use card `4242 4242 4242 4242`, any future expiry, any CVC
4. Complete payment → redirected back to `/?payment=success`

**What to verify in Supabase:**
```sql
SELECT plan, "planStatus", "trialEndDate", "stripeCustomerId", "stripeSubscriptionId"
FROM "CandidateProfile"
WHERE "userId" = 'paste-test-user-id-here';
```
Expected:
- `plan` = `monthly`
- `planStatus` = `trialing`
- `trialEndDate` = approximately 7 days from now
- `stripeCustomerId` and `stripeSubscriptionId` populated

**What to verify in the UI:**
- FreeBanner disappears
- TrialBanner appears: "Free trial — 7 days remaining. Your card will be charged after the trial."

---

## 8. Stripe checkout — 3-Month Bundle (one-time payment)

**Steps:**
1. Reset test account to free plan first:
```sql
UPDATE "CandidateProfile"
SET plan = 'free', "planStatus" = 'active', "stripeSubscriptionId" = NULL, "trialEndDate" = NULL
WHERE "userId" = 'paste-test-user-id-here';
```
2. Open upgrade modal → click "Get 3-Month Access"
3. Stripe Checkout opens (one-time payment, no subscription)
4. Use card `4242 4242 4242 4242` → complete payment

**What to verify in Supabase:**
- `plan` = `three_month`
- `planStatus` = `active`
- `accessExpiresAt` = approximately 90 days from now
- `stripeSubscriptionId` = NULL (it's not a subscription)

**UI:** No banner should show (paid, active, not trialing).

---

## 9. Stripe checkout — Annual plan (7-day trial)

Same flow as Monthly test (step 7) but click Annual. Verify:
- `plan` = `annual`
- `planStatus` = `trialing`
- `trialEndDate` ~7 days from now

---

## 10. Webhook events (using Stripe CLI)

Run in a terminal:
```bash
stripe listen --forward-to http://localhost:3002/api/stripe/webhook
```

Then trigger events manually:
```bash
# Simulate subscription cancelled
stripe trigger customer.subscription.deleted

# Simulate payment failed
stripe trigger invoice.payment_failed

# Simulate payment succeeded (comes back from past_due to active)
stripe trigger invoice.payment_succeeded
```

Watch Railway logs (or local server logs) for lines like:
```
[stripe/webhook] Event: customer.subscription.deleted
[stripe/webhook] Access revoked for subscriptionId=sub_xxx
```

**Note:** Triggered test events won't have a real `userId` in metadata, so the DB update won't fire — but you'll see the event arrive and be handled. To test the full flow, use the real Stripe Checkout (steps 7–9).

---

## 11. Trial ended — payment succeeds

After completing a Monthly trial checkout (step 7), go to the Stripe dashboard → Subscriptions → find the test subscription → click "Skip trial" to end the trial immediately. This triggers `invoice.payment_succeeded` → `planStatus` updates to `active`.

Verify in Supabase: `planStatus` = `active`.

---

## 12. Trial ended — payment fails

1. Set up a Monthly trial (step 7) but use card `4000 0000 0000 0341` (charge succeeds in trial but fails at end of trial)
2. In Stripe dashboard, skip the trial
3. Invoice payment fails → webhook fires `invoice.payment_failed`
4. Because `planStatus` was `trialing`, the handler immediately downgrades to free

Verify in Supabase:
- `plan` = `free`
- `planStatus` = `expired`
- UI: FreeBanner reappears

---

## 13. Past due (payment failed on renewal)

If a subscription is active and a payment fails (non-trial):
1. Stripe marks it `past_due`
2. Webhook fires → `planStatus` = `past_due`

UI: PastDueBanner appears: "Your last payment failed — update your card to keep access."
Clicking "Update payment →" calls `POST /api/stripe/portal` → Stripe Billing Portal opens.

To simulate:
```sql
UPDATE "CandidateProfile"
SET "planStatus" = 'past_due'
WHERE "userId" = 'paste-test-user-id-here';
```
Reload the dashboard → PastDueBanner should appear.

---

## 14. Cancellation

1. In Stripe dashboard → Subscriptions → Cancel subscription
2. Webhook fires `customer.subscription.deleted`
3. Handler sets `plan = 'free'`, `planStatus = 'cancelled'`

Verify in Supabase:
- `plan` = `free`
- `planStatus` = `cancelled`
- UI: FreeBanner reappears

---

## 15. Exempt email bypass

Log in as `kiron182@gmail.com` or `kiron@aussiegradcareers.com.au`.
- No banners should appear
- All features work regardless of plan/counter state
- Clicking "Start Free Trial" in the modal returns: `"This account has complimentary access."` (400 error)

---

## 16. Trial reminder email

The cron runs daily at 10:00 UTC (8:00 PM AEST). It emails users whose `trialEndDate` falls between now+20h and now+36h.

**To test without waiting:**
Set a test account's `trialEndDate` to 24 hours from now:
```sql
UPDATE "CandidateProfile"
SET "trialEndDate" = NOW() + INTERVAL '24 hours',
    "planStatus" = 'trialing',
    plan = 'monthly',
    email = 'real-email@example.com'
WHERE "userId" = 'paste-test-user-id-here';
```
Then trigger the cron manually by calling the function from the Railway console or deploying a temporary test endpoint. Alternatively, adjust the cron window temporarily in `trialReminderCron.ts` to match `now+0h to now+48h` and restart the server.

Check: email arrives from Resend with subject "Your free trial ends tomorrow".

---

## 17. API status endpoint

You can check a user's subscription state directly:

```bash
curl -H "Authorization: Bearer <supabase-jwt>" \
  https://your-railway-url/api/stripe/status
```

Returns:
```json
{
  "plan": "monthly",
  "planStatus": "trialing",
  "trialEndDate": "2026-05-04T10:00:00.000Z",
  "accessExpiresAt": null,
  "freeGenerationsUsed": 2,
  "freeAnalysesUsed": 1,
  "freeJobSearchesUsed": 1,
  "freeMatchScoresUsed": 0,
  "stripeCustomerId": "cus_xxx"
}
```

---

## Quick reset (start fresh for any test user)

```sql
UPDATE "CandidateProfile"
SET
  plan = 'free',
  "planStatus" = 'active',
  "trialEndDate" = NULL,
  "accessExpiresAt" = NULL,
  "stripeCustomerId" = NULL,
  "stripeSubscriptionId" = NULL,
  "freeGenerationsUsed" = 0,
  "freeAnalysesUsed" = 0,
  "freeJobSearchesUsed" = 0,
  "freeMatchScoresUsed" = 0,
  "dashboardAccess" = FALSE
WHERE "userId" = 'paste-test-user-id-here';
```

---

## Known gaps (not yet wired)

- **MatchEngine** does not yet call `showUpgradeModal('match_score')` on 402 — it will fail silently
- **ApplicationWorkspace** generate buttons do not yet call `showUpgradeModal('generation')` on 402 — the API blocks the generation but no modal appears

These need the API call sites to check for `response.status === 402` and dispatch the `show-upgrade` event. Ask to wire these up when ready to test end-to-end.
