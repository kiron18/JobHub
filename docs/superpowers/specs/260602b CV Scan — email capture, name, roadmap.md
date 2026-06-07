# SPEC ADDENDUM — Email capture · name personalisation · roadmap delivery

**Date:** 2026-06-02
**Builds on:** `260602 CV Gap Scan (resume-only, no-auth).md` (the base scan must exist first).
**Status:** Ready to build
**Execution note:** ZERO-LATITUDE. Do exactly this. **🛑 STOP** = halt and report, do not improvise. Do not change auth, do not force account creation, do not touch unrelated routes.

---

## Decisions locked (do not revisit)
- **Lead row only — NO password / NO Supabase auth account.** Anonymous lead captured by email.
- **Roadmap delivered BOTH on-screen AND by email.**
- **Name comes from the scan LLM**, not a separate scraper. Personalise the report (pre-email) when a name is found; silently omit when not.
- **Roadmap is generated only for converters** (after email), not for every scan — saves cost and makes the unlock feel earned.

---

## A. Name extraction — extend the existing scan (no new LLM pass)

In `server/src/services/cvGapScan.ts`:
1. Add `firstName: string` and `fullName: string` to: `LlmResponse`, the prompt's JSON shape, and `CvGapResult`.
2. Prompt instruction (add near `inferredRole`):
   > `firstName` / `fullName`: extract from the resume's header/contact block. If a real human name is not clearly present, return "" for both. NEVER guess or invent a name.
3. Pass them straight through `assembleResult` into `CvGapResult`. No server-side string formatting.

**Frontend personalisation (pre-email, in `GapReportSample`'s live equivalent / the `done` state):**
- If `firstName` non-empty: header reads `{firstName} — your CV gap report`; intro line `{firstName}, here's what's quietly costing you callbacks`.
- If empty: fall back to `Your CV gap report` with no name anywhere. Never render `" — "` with a blank name.

---

## B. Server-side scan cache + scanId (needed for the gated roadmap)

The base scan currently returns the full result inline. Change it so the roadmap content is NOT shipped until email is given.

In `server/src/routes/cv-scan.ts`:
1. Module-level `Map<string, { resumeText: string; result: CvGapResult; at: number }>` named `scanStore`, TTL **60 min**. Reuse the bounding/eviction style of `lib/analysisCache.ts`.
2. On a successful scan: generate `scanId = crypto.randomUUID()`, store `{ resumeText, result, at: Date.now() }`, and return to the client:
   ```ts
   { scanId, score, inferredRole, firstName, fullName,
     items, quickWins, lockedGapCount: 7 } // lockedGapCount is a fixed teaser number
   ```
   Do NOT return any roadmap here.
- 🛑 STOP if `crypto.randomUUID` is unavailable in the Node version — use `uuid` (already a dependency per schema `@default(uuid())`).

---

## C. New endpoint: `POST /api/cv-scan/lead` (no auth, IP rate-limited)

New handler in `server/src/routes/cv-scan.ts` (same router):
- Chain: `ipRateLimit` → JSON body parser.
- Body: `{ scanId: string; email: string }`.
- Steps:
  1. Validate `email` with a simple regex; invalid → `400 { error: 'Enter a valid email' }`.
  2. `const entry = scanStore.get(scanId)`. Miss/expired → `410 { error: 'Your scan expired — please scan again.' }`.
  3. Generate the **roadmap** via one LLM call (§D).
  4. Upsert the lead row (§E) — `email` is the unique key; update name/role/score on repeat.
  5. Fire the email (§F) — **await it but do not fail the request if email send throws**; log and continue (the on-screen unlock must still work).
  6. Return `{ roadmap }` (the `RoadmapStep[]` from §D).
- Wrap in try/catch → `502 { error: 'Could not build your roadmap, please try again.' }`, `console.error('[cv-scan/lead]', err)`.

---

## D. Roadmap generation (new fn in `cvGapScan.ts`)

```ts
export interface RoadmapStep {
  rank: number;        // 1 = highest leverage
  title: string;       // ≤ 60 chars, imperative — "Rewrite your opening bullet"
  why: string;         // ≤ 140 chars — the concrete payoff
}
export async function runRoadmap(resumeText: string, firstName: string): Promise<RoadmapStep[]>
```
- One `callClaude(prompt, true)` call. Prompt rules:
  - "Produce exactly 7 prioritised, specific action steps to fix this resume, ranked 1 (highest leverage) to 7."
  - Each `title` ≤60 chars, imperative; each `why` ≤140 chars, names the concrete payoff (more callbacks, passes ATS, recruiter stops scrolling).
  - **Grounded + specific** — reference real elements of THIS resume. Same banned-generic rules and **no-visa-talk** rule as the base scan prompt.
  - "Sequenced so {firstName or 'they'} knows exactly what to do first." Accountable tone: numbered, concrete, this-week-able.
  - Return ONLY `{ "roadmap": [{ "rank": number, "title": string, "why": string }] }`.
- Parse with the same fence-strip + 2-attempt retry helper used by the base scan. On total failure, throw (route → 502).

---

## E. Lead storage (mirror `SponsorLead` exactly)

1. **Prisma model** in `server/prisma/schema.prisma` (copy the `SponsorLead` shape):
   ```prisma
   model CvScanLead {
     id           String   @id @default(uuid())
     email        String   @unique
     firstName    String?
     fullName     String?
     inferredRole String?
     score        Int?
     createdAt    DateTime @default(now())
   }
   ```
2. **Bootstrap table** — in `ensureColumns()` in `server/src/index.ts`, add a block mirroring the existing `CREATE TABLE IF NOT EXISTS "SponsorLead"` call:
   ```ts
   await prisma.$executeRawUnsafe(`
     CREATE TABLE IF NOT EXISTS "CvScanLead" (
       "id" TEXT PRIMARY KEY,
       "email" TEXT UNIQUE NOT NULL,
       "firstName" TEXT,
       "fullName" TEXT,
       "inferredRole" TEXT,
       "score" INTEGER,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     );
   `);
   ```
3. Write via `prisma.cvScanLead.upsert({ where: { email }, create: {...}, update: { firstName, fullName, inferredRole, score } })`.
- 🛑 STOP if `ensureColumns` structure has changed and the `SponsorLead` block is no longer there to mirror.
- After editing `schema.prisma`, run `npx prisma generate` (NOT `migrate`/`db push` — table creation is handled by `ensureColumns`, matching the project's existing pattern).

---

## F. Email via Resend (mirror existing `email.ts`)

Add `export async function sendRoadmapEmail(to: string, firstName: string, result: CvGapResult, roadmap: RoadmapStep[])` in `server/src/services/email.ts`, using the same `resend.emails.send({...})` pattern as the existing functions.
- Subject: `${firstName ? firstName + ', ' : ''}your CV roadmap — 7 fixes, in order`.
- Body (HTML, match the tone/styling of the other emails in this file): the score, the inferred role, then the 7 ranked `RoadmapStep`s as a numbered list (title bold, why beneath). Keep it skimmable.
- 🛑 STOP if `RESEND_API_KEY` is not configured in the server env — report; do not hardcode a key.

---

## G. Frontend (`src/pages/MockLandingPage.tsx`)

In the scan `done`/`email` reveal step:
1. Replace the disabled "Email address (coming soon)" box with a real `<input type="email">` + a submit `CTA` ("Unlock my roadmap →").
2. On submit: POST `/api/cv-scan/lead` with `{ scanId, email }` (the `scanId` from the scan response — thread it through `ScanPanel` state). Show "Building your roadmap…" spinner.
3. On success: render the returned `roadmap` on screen as a clean numbered list (reuse the quick-wins card styling), and `toast.success('Roadmap also sent to your inbox')`.
4. Personalise the whole result with `firstName` per §A.
5. **Consent line** under the input (required): `We'll email your roadmap and job-search tips. No spam, unsubscribe anytime.` with a link to `/legal/privacy` (existing `LegalPage` route).
- Optional nice-to-have (do only if trivial): if the scan response ever includes a scraped email, pre-fill the input — but the submit stays explicit (consent).

---

## H. Definition of done (report all)
1. `npx tsc -b` (frontend) + server typecheck both pass.
2. Scan returns `scanId` + `firstName`; report shows the name when present, degrades cleanly when absent.
3. `POST /api/cv-scan/lead` with a valid scanId+email: writes one `CvScanLead` row, returns 7 roadmap steps, and a Resend email arrives.
4. Expired/biscanId → 410 with the friendly message; the on-screen unlock still works even if the email send fails.
5. On-screen roadmap renders, personalised, with the consent line + privacy link visible.

---

## Out of scope (do NOT build)
- Upgrading the lead into a full Supabase auth account (later).
- Server-side encryption of `scanStore` / persisting resume text to DB (it stays in-memory, 60-min TTL).
- Double opt-in / email verification (v1 single opt-in with consent line).
