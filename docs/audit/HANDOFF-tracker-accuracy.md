# Handoff — admin tracker accuracy (2026-07-31 → 2026-08-01)

Everything done in the session that fixed the admin client tracker. Written so this
window can be closed and the work continued from one terminal.

**Branch:** `staging`. Committed as `feat: make the admin client tracker accurate`.

---

## The complaint

"The tracker isn't accurately logging resumes generated. Pawan has 114, the tracker says 75/76."

## What was actually true

The **114 was never wrong**. `/admin/users` read `Document` rows of type `RESUME` and the
database held exactly 114 for `pawanhew7@gmail.com`. The **75** was the *Apps sent* column,
rendered bold as the first number on the row, and it was under-counting for a different reason.

For the record, his cumulative resume count went 22 (May) → 61 (Jun) → 114 (Jul). All documents
of every type is 230; resumes plus cover letters is 228.

## The five real defects found

| # | Defect | Effect |
|---|---|---|
| 1 | `applicationsSent` filtered on `status = 'APPLIED'` | Every app that reached interview / rejected / offer vanished. Pawan: 75 shown, 82 real |
| 2 | Mayank Parekh + Kangeshvar Nagarajan marked `plan=free` | Two paying clients invisible to any paid-only filter |
| 3 | No test-account filtering | 163 rows, 136 with no email, mostly internal signups |
| 4 | Counts keyed on `userId`, not person | A duplicate signup split someone's history silently |
| 5 | `dateApplied` not kept in step with `status` | 4 sent apps invisible to client tracker / leaderboard / coach view; 2 saved apps counted as sent |

### Defect 2 root cause
The Stripe webhook can only stamp a profile when it resolves the payment to a `userId`.
Mayank **paid 11 Jul, signed up 13 Jul** — no profile existed yet. Kangeshvar paid through a
**bare payment link** (`py_…`), which produces no Stripe customer object and no metadata.
Both fell through to the unmatched-payment alert. **Both predate the fix**: the webhook's
email fallback and cold-buyer auto-onboarding landed 2026-07-13 (commit `13f9282`), after
Kangeshvar (26 Jun) and Mayank (11 Jul) paid. Payments since then are marked automatically.

### Defect 5 root cause
`PATCH /api/jobs/:id` set `status` without touching `dateApplied`. The client tracker,
leaderboard and coach view all filter on `dateApplied`, so an application the client had
genuinely sent counted nowhere they could see it.

## Three competing definitions of "an application" existed

- **admin user-usage** — `status === 'APPLIED'`, raw rows
- **admin funnel** — `status !== 'SAVED'`, raw rows
- **client tracker / leaderboard / coach** — `dateApplied != null`, deduped by `sourceUrl`

Now unified on `SENT_APPLICATION_FILTER` (`status != 'SAVED'`).
Note: **every paying client's applications have a null `sourceUrl`**, so the `countDistinctJobs`
dedup is currently a no-op for them. Duplicates were never the problem — verified, zero repeat URLs.

---

## Changes made

| File | Change |
|---|---|
| `server/src/services/tracker/metricHelpers.ts` | **New** `SENT_APPLICATION_FILTER`, `SENT_STATUSES`, `isSentStatus` — the single definition |
| `server/src/routes/admin-funnel.ts` | `/user-usage` rewritten: paid-only, 3-signal payment test, test-account + `+tag` exclusion, grouped by email, totals block, `unidentified` list. All three endpoints now use the shared filter |
| `server/src/routes/profile/jobs.ts` | POST + PATCH now stamp `dateApplied` when a job enters a sent status and clear it on return to SAVED |
| `src/pages/AdminUserUsage.tsx` | Paid-only roster, resumes as the bold headline, criteria + first-gen columns, merged-account badge, unidentified footnote |
| `server/src/services/tracker/__tests__/sentApplication.test.ts` | **New** — locks the definition against regression |
| `server/scripts/reconcile-paid-clients.ts` | **New** — the Mayank/Kangeshvar billing repair, dry-run by default |
| `server/scripts/backfill-date-applied.ts` | **New** — the `dateApplied` repair, dry-run by default |
| `server/src/services/paymentReconcile.ts` | **New** — Stripe sweep that grants access to any payer marked free. Grant-only, never revokes |
| `server/src/cron/paymentReconcileCron.ts` | **New** — runs the sweep daily at 11:00 UTC, alerts on payers with no account |
| `server/src/index.ts` | Registers the reconciliation cron |
| `server/scripts/reconcile-stripe-payments.ts` | **New** — run the sweep by hand, dry-run by default |

## Database writes already applied to production

Both were run with `--write` and verified:

1. **`reconcile-paid-clients.ts`** — Mayank → `monthly/active` + Stripe customer & subscription ids
   + `dashboardAccess=true`; Kangeshvar → `three_month/active` + `dashboardAccess=true`
   + `accessExpiresAt=2026-09-24` (three months from his 26 Jun payment, per Kiron 2026-08-01).
2. **`backfill-date-applied.ts`** — 4 sent apps given a `dateApplied` (from `updatedAt`, the row's
   last status change — the honest proxy, not an invented date); 2 saved apps had a stale date cleared.
   Re-run of the dry run now reports **0 and 0**.

## Verified state

Admin "sent" now equals client-tracker "sent" for **every** paying client:

| Client | Plan | Sent | Started | Resumes | Covers |
|---|---|---|---|---|---|
| Pawan Hewage | three_month | 82 | 86 | 114 | 114 |
| Mayank Parekh | monthly | 101 | 101 | 107 | 106 |
| Vaibhav Singh | monthly | 48 | 49 | 53 | 50 |
| Khushal Malik | monthly | 22 | 22 | 25 | 23 |
| Kangeshvar Nagarajan | three_month | 6 | 6 | 12 | 11 |
| Ananya Awasthi | three_month | 9 | 9 | 5 | 6 |
| Revathi Surya | monthly | 1 | 1 | 1 | 1 |

Server typecheck clean. **499 tests pass** (was 489; +10 new).

### The paid roster, from Stripe (live key)
4 active $250/mo subscriptions (Mayank, Vaibhav, Khushal, Revathi) + 3 non-refunded one-offs
(Pawan $197, Kangeshvar $500, Ananya $197). **Ruthuparna excluded — refunded and cancelled.**

---

## Open items

1. **`MONTHLY_PRICE_ID` in `server/.env` is stale** — points at the old $97 price
   (`price_1TQdG0…`); live subscriptions use `price_1TnG71…` at $250.
2. **Resumes are not linked to applications.** 110 of Pawan's 114 have a null `jobApplicationId`
   (`temp-id` is coerced to null), so "which resume went to which job" is unanswerable.
3. **`/admin/funnel/overview` still has its own paid definition** — correct now that the DB is
   repaired, but it is a second definition and should use `isPaidNow`.

## Note on unrelated working-tree changes

Another session was editing `buildTemplateResume.ts`, `generationV2.ts`, `resumeStructuredPrompt.ts`
and `exportPdf.tsx` while this one ran; those have since settled, leaving only
`src/lib/__tests__/__snapshots__/exportPdf.parse.test.ts.snap` modified in the tree. It was not
touched here and is not part of this work. Check before committing.

## Automatic paid-marking — how it works now

1. **At payment (primary).** The Stripe webhook resolves the buyer by `metadata.userId`, then by
   email, then auto-onboards a cold buyer who has no account. Live since 2026-07-13.
2. **Daily sweep (safety net, new).** 11:00 UTC, `paymentReconcileCron` scans Stripe
   subscriptions and the last 120 days of charges, and grants access to any payer still marked
   free. It **only grants, never revokes** — a missing Stripe record is far more likely to be an
   API hiccup than a cancellation, and wrongly cutting off a paying client is the worse failure.
   Cancellations remain the webhook's job. A payer with no account triggers the admin alert
   rather than being silently onboarded.

Verified against live Stripe: 7 payers found, 0 needing a grant.

```
npx tsx -r dotenv/config scripts/reconcile-stripe-payments.ts            # dry run
npx tsx -r dotenv/config scripts/reconcile-stripe-payments.ts --write    # apply
```
