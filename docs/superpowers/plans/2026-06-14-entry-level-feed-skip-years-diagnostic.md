# 2026-06-14 — Entry-level feed, skip/undo, years source-of-truth, remove Diagnostic tab

## For DeepSeek — read this first

This is a **zero-latitude** plan. Do exactly what each step says. Do not refactor
adjacent code, do not rename things, do not "improve" anything not listed.

- **Claude owns all user-facing copy and all LLM prompt text.** Every such string
  is given below verbatim inside a `LOCKED COPY` block. Transcribe it character for
  character. Do not paraphrase. Do not add or remove words.
- **No em dashes or en dashes** anywhere in copy or prompts. Use a plain hyphen with
  spaces, or rewrite. This is non-negotiable.
- Where a step says **STOP AND REPORT**, do not guess. Stop, write down what you
  found, and wait for a decision before continuing that workstream.
- Run the verification at the end of each workstream before moving to the next.

Workstreams are independent. Do them in this order: A, B, C, D.

---

## Workstream A — Remove the Diagnostic tab (unblocks the load loop)

**Goal:** remove the Diagnostic entry from the sidebar and from the Profile area.
Do NOT delete the diagnostic onboarding flow itself (it is part of first-time
signup). Only remove the post-onboarding navigation entry points.

### A1. Sidebar nav entry

File: `src/layouts/DashboardLayout.tsx`

Around line 130 there is this nav item inside the `navItems` array:

```ts
{ onClick: () => window.dispatchEvent(new CustomEvent('show-diagnostic')), icon: Stethoscope, label: 'Diagnostic' },
```

Delete that entire line.

Then remove the now-unused `Stethoscope` import at the top of the file (it is
imported from `lucide-react`). If `Stethoscope` is used anywhere else in this file,
**STOP AND REPORT** instead of removing the import.

### A2. Profile-area entry

Search the frontend for any other place that renders a Diagnostic tab, button, or
link in the Profile / workspace page:

```
grep -rni "show-diagnostic\|label.*Diagnostic\|>Diagnostic<" src/
```

For each result that is a **navigation control** (a tab, button, or link the user
clicks to open the diagnostic), remove that control only.

Do NOT touch:
- `src/components/DiagnosticPage.tsx` (the page itself)
- `src/App.tsx` first-time onboarding routing (the `stage === 'diagnostic'` flow)
- Admin dashboard diagnostic stats

If you cannot tell whether a given reference is a post-onboarding nav control or
part of required onboarding, **STOP AND REPORT** with the file and line.

### A3. The load loop

The user reports being "stuck in a loop trying to load" the diagnostic. After A1 and
A2, confirm the sidebar no longer dispatches `show-diagnostic`. Do NOT change the
`App.tsx` event listener or stage machine in this workstream. If removing the nav
entries does not stop the loop, **STOP AND REPORT** — do not start editing the stage
machine on your own.

### A verification
- `npm run build` (frontend) passes.
- Sidebar renders without a Diagnostic item.
- First-time onboarding still reaches the diagnostic page (manually: a brand-new
  profile still routes through it).

---

## Workstream B — Store all 3 target roles and run one combined entry-level Seek search

**Goal:** the daily feed currently searches a single `targetRole`. Change it so all
of the user's target roles plus entry-level qualifiers go into ONE natural-language
Seek search, and senior listings are pushed to the bottom.

### B1. Find where the 3 onboarding roles are stored

The onboarding step "Roles we'll search for you (up to 3)" collects up to three
roles. The schema `CandidateProfile` has only a singular `targetRole`
(`server/prisma/schema.prisma` line 36).

Run:
```
grep -rni "targetRole\|roles we'll search\|Up to 3\|targetRoles" server/src src/
```

Determine where the 3 roles are persisted today.
- If only `targetRole` exists and the other two are discarded, proceed to B2 to add
  storage.
- If the 3 roles are already stored somewhere (a Json column, a related table),
  **STOP AND REPORT** the exact field so we do not create a duplicate.

### B2. Schema: add a roles array (only if B1 found no existing storage)

File: `server/prisma/schema.prisma`, model `CandidateProfile`.

Add this field directly below the existing `targetRole` line (line 36):

```prisma
  targetRoles                  Json?
```

`targetRoles` holds an array of strings, e.g. `["Laboratory Technician","Quality Control Officer"]`.
Keep the existing `targetRole` column unchanged (it remains the primary role and the
fallback).

Then:
```
cd server && npx prisma migrate dev --name add_target_roles
```

Wire the onboarding write path (found in B1) to save the full array into
`targetRoles` while continuing to set `targetRole` to the first role. Do not change
any onboarding copy.

### B3. Build the combined search term

File: `server/src/services/seekScraper.ts`

At the top of the file, add this exported constant. **LOCKED COPY — transcribe exactly:**

```ts
// Entry-level qualifier prefix for Seek natural-language search. Seek treats these
// as soft relevance signals, not hard filters, so B5 still demotes senior listings.
export const ENTRY_LEVEL_QUALIFIERS = 'entry level graduate junior starter';

// Build one natural-language Seek search term from the candidate's target roles
// plus the entry-level qualifiers. Seek ranks across all the words.
export function buildEntryLevelSearchTerm(roles: string[]): string {
  const cleaned = roles.map(r => r.trim()).filter(r => r.length > 0);
  const joined = cleaned.join(' ');
  return `${ENTRY_LEVEL_QUALIFIERS} ${joined}`.trim();
}
```

### B4. Use the combined term in the daily feed

File: `server/src/services/jobFeed.ts`, function `buildDailyFeed` (starts line 184).

1. Change the profile select (line 187) to also pull `targetRoles`:

```ts
    select: { targetRole: true, targetRoles: true, targetCity: true, location: true, industry: true, skills: true },
```

2. Immediately after the `effectiveCity` / incomplete-profile guard (after line 193),
   build the roles array and the combined term. Import `buildEntryLevelSearchTerm`
   from `./seekScraper` at the top of the file.

```ts
  const rolesArray: string[] = Array.isArray(profile.targetRoles) && profile.targetRoles.length > 0
    ? (profile.targetRoles as string[])
    : [profile.targetRole];
  const seekSearchTerm = buildEntryLevelSearchTerm(rolesArray);
```

3. Replace the Seek cluster construction (line 195) so the cluster's `role` carries
   the combined term:

```ts
  const seekCluster = buildSeekClusterKey(seekSearchTerm, effectiveCity, profile.industry);
```

Leave the Adzuna and LinkedIn calls unchanged for now (they still use
`profile.targetRole`). Do NOT change `maxResults` here; that is set in B6.

### B5. Demote senior listings (alignment guarantee)

The combined search improves the input but does not exclude senior roles. Add a
seniority penalty to ranking.

File: `server/src/services/jobFeed.ts`. Find the `quickScore` function used at
line 232 (`matchScore: quickScore(profile.skills, j)`).

Add this exported constant near the top of the file. **LOCKED COPY — transcribe exactly:**

```ts
// Title/description signals that mark a listing as too senior for an entry-level
// candidate. Listings matching any of these are pushed down the feed, not removed.
const SENIOR_SIGNALS = [
  'senior', 'principal', 'lead ', 'team lead', 'head of', 'director',
  'manager', '5+ years', 'minimum 5 years', 'extensive experience',
];
```

Inside `quickScore`, after the existing score is computed and before it is returned,
subtract a penalty when the job title or description contains a senior signal:

```ts
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  if (SENIOR_SIGNALS.some(sig => haystack.includes(sig))) {
    score -= 1000; // pushes senior roles to the bottom without dropping them
  }
```

Adapt the variable names (`score`, `job`) to whatever `quickScore` actually uses. If
`quickScore` does not return a single mutable numeric `score`, **STOP AND REPORT** its
real shape before editing.

### B6. Coverage knob

Because one search now covers up to 3 roles, raise the Seek result count so each role
keeps coverage.

File: `server/src/services/seekScraper.ts`, function `fetchSeekJobsForCluster`,
the Apify call input (around line 105). Change:

```ts
        maxResults: opts?.maxResults ?? 30,
```
to:
```ts
        maxResults: opts?.maxResults ?? 75,
```

### B verification
- `cd server && npx prisma generate && npm run build` passes.
- Trigger a feed build for a test user with 2-3 target roles. Confirm the Seek search
  term logged is the combined entry-level string.
- Confirm senior-titled jobs appear at the bottom of `jobFeedItem` ordering, not the top.

---

## Workstream C — Years of experience: compute once, store, single source of truth

**Goal:** one number, computed once from experience dates, stored on the profile, read
by every generator. Stop the cover letter from inventing its own figure.

Per the architecture decision: **do not delete** `resolveYearsOfExperience` (it is the
calculator) and **do not delete** `coverLetterSlotsPrompt` (it writes the letter). The
fix is to compute once and have every generator consume the stored value.

### C1. Schema: store the computed value

File: `server/prisma/schema.prisma`, model `CandidateProfile`. Add below `seniority`
(line 34):

```prisma
  yearsOfExperience            Int?
```

Migrate:
```
cd server && npx prisma migrate dev --name add_years_of_experience
```

`null` means "not yet computed" or "fewer than 2 years" (treated as suppress, see C4).

### C2. Compute and store once

Find every place a candidate profile is built or its experience records are written
from extraction:
```
grep -rni "resolveYearsOfExperience\|experience.*create\|professionalSummary" server/src/services server/src/routes
```

In the single canonical profile-build / extract completion path (most likely
`server/src/services/autoExtract.ts` or the onboarding profile write), after the
experience rows are persisted, compute and store:

```ts
const computedYears = resolveYearsOfExperience(
  [profile.professionalSummary, profile.resumeRawText],
  experienceRows,
);
await prisma.candidateProfile.update({
  where: { userId },
  data: { yearsOfExperience: computedYears >= 2 ? computedYears : null },
});
```

If there is more than one place that builds the profile from extraction, **STOP AND
REPORT** the list so we pick exactly one owner. Do not store it in two places.

### C3. Resume generator reads the stored value

File: `server/src/routes/generate.ts`, route `/resume-structured` (line 573).

It currently calls `resolveYearsOfExperience` at generation time (around line 672).
Replace that call with the stored value:

```ts
const resumeYears = profile.yearsOfExperience ?? undefined;
```

Pass `resumeYears` into `buildTemplateResume` exactly where the old computed value was
passed. Do not change `buildTemplateResume` itself.

### C4. Cover letter generator reads the stored value (this is the real bug)

File: `server/src/routes/generate.ts`, route `/cover-letter-structured` (line 744).
The call to `COVER_LETTER_SLOTS_PROMPT` (around line 835) passes no years value, so the
LLM invents one.

File: `server/src/services/prompts/coverLetterSlotsPrompt.ts`. Add a new final
parameter `yearsOfExperience?: number | null` to the `COVER_LETTER_SLOTS_PROMPT`
signature, and inject this block into the prompt body where candidate facts are
described. **LOCKED COPY — transcribe exactly, including the conditional:**

```ts
const yearsBlock = (yearsOfExperience && yearsOfExperience >= 2)
  ? `YEARS OF EXPERIENCE: The candidate has ${yearsOfExperience} years of professional experience. When you refer to length of experience, use exactly this number. Never state a different figure.`
  : `YEARS OF EXPERIENCE: Do not state any number of years of experience. Lead with the qualification and the nature of the experience instead.`;
```

Place `${yearsBlock}` into the prompt near the candidate summary. Then in
`generate.ts` pass `profile.yearsOfExperience` as the new final argument to
`COVER_LETTER_SLOTS_PROMPT(...)`.

### C5. Selection criteria

File: `server/src/services/prompts/selectionCriteriaPrompt.ts`. If this prompt states
or implies a number of years, apply the same `yearsBlock` rule. If it never mentions
years, leave it unchanged and note that in your report.

### C verification
- `cd server && npx prisma generate && npm run build` passes.
- Generate resume + cover letter for the same test profile. Both state the SAME number
  of years, or both omit it when stored value is null / under 2.
- Confirm no generator calls `resolveYearsOfExperience` at request time anymore (it is
  only called once at profile-build).

---

## Workstream D — Skip a job, with undo

**Goal:** user can hide a job from their feed and undo it.

### D1. Schema: mark feed items skipped

File: `server/prisma/schema.prisma`. Find `model JobFeedItem` (search the file).
Add two fields:

```prisma
  skipped     Boolean   @default(false)
  skippedAt   DateTime?
```

If there is no `JobFeedItem` model (jobs are stored under a different model name),
**STOP AND REPORT** the actual model that backs the job feed before editing.

Migrate:
```
cd server && npx prisma migrate dev --name add_job_skip
```

### D2. Endpoint

Add a route to toggle skip on a feed item, scoped to the authenticated user. Find the
existing job-feed route file:
```
grep -rni "jobFeedItem\|/job-feed\|router.*feed" server/src/routes
```

Most likely `server/src/routes/job-feed.ts`. Add (adapt to the file's existing style):

```ts
// PATCH /job-feed/:id/skip  body: { skipped: boolean }
router.patch('/:id/skip', authenticate, async (req: any, res: any) => {
  const userId = req.user.id as string;
  const { id } = req.params;
  const { skipped } = req.body;
  const item = await prisma.jobFeedItem.findFirst({ where: { id, userId } });
  if (!item) return res.status(404).json({ error: 'Job not found' });
  await prisma.jobFeedItem.update({
    where: { id },
    data: { skipped: !!skipped, skippedAt: skipped ? new Date() : null },
  });
  res.json({ ok: true, skipped: !!skipped });
});
```

Use the auth middleware import already present in that file. Do not invent a new auth
pattern.

### D3. Feed query hides skipped items

In the same route file, find the GET handler that returns the feed list. Add
`skipped: false` to its `where` clause so hidden jobs do not appear in the main feed.
Do NOT delete skipped rows — undo depends on them surviving.

### D4. Frontend skip control + undo

Find the job card / feed list component:
```
grep -rni "jobFeedItem\|JobCard\|ApplyFeedStrip\|job feed" src/
```

Likely candidates: `src/pages/JobFeedPage.tsx`, `src/components/jobs/JobCard.tsx`,
`src/components/strategy/ApplyFeedStrip.tsx`. Confirm which one renders the feed list
the user sees, then:

1. Add a Skip control to each job card.
2. On click: call `PATCH /job-feed/:id/skip { skipped: true }`, optimistically remove
   the card from the list, and show an undo affordance.
3. Undo calls `PATCH /job-feed/:id/skip { skipped: false }` and restores the card.

**LOCKED COPY — use these strings exactly:**
- Skip control label: `Skip`
- Undo toast / inline message: `Hidden from your feed`
- Undo action label: `Undo`

If the feed list is rendered by more than one component, **STOP AND REPORT** which
ones before wiring, so we add the control in exactly one place.

### D verification
- `cd server && npx prisma generate && npm run build` passes; frontend `npm run build` passes.
- Skip a job: it disappears from the feed and `skipped=true` in the DB.
- Undo within the same view: the job returns and `skipped=false`.
- Reload the feed: skipped jobs stay hidden.

---

## Out of scope (do not touch)
- The diagnostic onboarding flow logic in `App.tsx`.
- Any LLM prompt copy not quoted in a LOCKED COPY block above.
- Adzuna and LinkedIn search terms (Seek only this round).
- Cross-user Seek cache dedup (intentionally left as-is for a small user base).
