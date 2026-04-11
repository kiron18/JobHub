# Quick Fixes — Design Spec

**Date:** 2026-04-11
**Status:** Approved
**Scope:** 8 independent fixes across ProfileBank, ApplicationWorkspace, ApplicationTracker, and sidebar nav

---

## Overview

A batch of independent improvements: missing CRUD for profile sections, a rate-limited Analyse Profile, SC tab UX cleanup, typography fix, three removal tasks, optimistic status updates, and a LinkedIn Coming Soon nav item.

---

## Fix 1 — Profile Bank: Add editing for Education, Certifications, Volunteering, Skills

### Problem
Education, Certifications, and Volunteering sections in ProfileBank display "No records found" with no way to add or edit entries. Skills is editable in principle but has no tag-based UI.

### Server changes

**Education** — add to `server/src/routes/profile/education.ts`:
- `POST /education` — create a new education record linked to the authenticated user's profile. Body: `{ institution, degree, field?, year? }`
- `DELETE /education/:id` — delete a record owned by the authenticated user

**Certifications** — new file `server/src/routes/profile/certifications.ts`:
- `POST /certifications` — body: `{ name, issuingBody, year? }`
- `PATCH /certifications/:id` — body: `{ name?, issuingBody?, year? }`
- `DELETE /certifications/:id`

**Volunteering** — new file `server/src/routes/profile/volunteering.ts`:
- `POST /volunteering` — body: `{ organization, role, description? }`
- `PATCH /volunteering/:id` — body: `{ organization?, role?, description? }`
- `DELETE /volunteering/:id`

All three routers registered in `server/src/routes/profile/index.ts`.

### Frontend changes (`src/components/ProfileBank.tsx`)

Each section gets:
- A **"+ Add"** button in the section header (same `EditButton` style as existing sections)
- An inline collapsible add form (matching existing `slideIn` animation pattern)
- Each existing record gets a small **×** delete icon
- Education and Certification records also get an edit (pencil) icon opening an inline edit form

**Skills section** — add a tag editor:
- Display existing skills as dismissible pills
- Text input: type a skill + press Enter to add; click × on a pill to remove
- Saves as comma-separated string to `PATCH /profile` (existing endpoint)

---

## Fix 2 — Analyse Profile: daily rate limit + smart gate

### Problem
The "Analyse Profile" button in `ProfileAdvisorPanel` can be called without limit, enabling abuse and unnecessary LLM cost.

### Server changes

**Schema** — add two fields to `CandidateProfile` in `schema.prisma`:
```prisma
profileAdvisorCallsToday  Int       @default(0)
profileAdvisorCallsDate   DateTime?
```

**Route** — in `/analyze/profile-advisor` (inside `server/src/routes/ai-tools.ts`):
1. Load `profileAdvisorCallsToday` and `profileAdvisorCallsDate` from the profile
2. If `profileAdvisorCallsDate` is today (UTC) and `profileAdvisorCallsToday >= 3`: return `429 { error: 'DAILY_LIMIT_REACHED', callsToday: 3 }`
3. If `profileAdvisorCallsDate` is a previous day: reset counter to 0, set date to today
4. On successful response: increment counter and update date

**Env var:** `MAX_DAILY_PROFILE_ANALYSES=3` (default 3; single line to change)

### Frontend changes (`src/components/ProfileAdvisorPanel.tsx`)

On 429 response: show inline message — *"You've analysed your profile 3 times today. Come back tomorrow, or make manual edits and re-check then."*

Smart gate (UI only, no additional server call):
- If last analysis returned `score >= 75` and `analysisCount >= 1` in session: show amber message before next analysis — *"Your profile already scores X/100. Another pass gives diminishing returns — consider editing your achievements directly."* with an "Analyse anyway" link that bypasses the UI gate (but still subject to the server daily limit).

---

## Fix 3 — SC Tab: stop auto-generate, add explicit button, clean up panel

### Problem
Pasting criteria text into the SC textarea immediately triggers generation. The left panel is cluttered with unrelated panels (LinkedIn Optimiser, Salary Insight, Profile Gap Analysis).

### Frontend changes (`src/components/ApplicationWorkspace.tsx`)

**Stop auto-generate:**
- Add `const [scConfirmed, setScConfirmed] = useState(false)` state (reset when `state.activeTab` changes away from SC)
- In the auto-generate `useEffect`, replace `scReady` check with: `scReady && scConfirmed`
- When `state.activeTab` changes to something other than `'selection-criteria'`, reset `scConfirmed` to `false`

**Explicit generate button:**
- When SC tab is active + criteria text is pasted (>20 chars) + `!scConfirmed` + no existing document: show a blue "Generate SC Responses" button below the paste area
- Clicking it sets `scConfirmed = true`, which triggers the existing `useEffect`

**Left panel cleanup for SC tab (remove):**
- Remove `<SalaryInsightPanel>` and all related imports/state (also covers Fix 5)
- Remove LinkedIn Optimiser section and related state: `linkedInDoc`, `generatingLinkedIn`, `linkedInViewerOpen`, `handleGenerateLinkedIn` (also covers Fix 6)
- Remove Profile Gap Analysis panel from the SC tab left sidebar

---

## Fix 4 — SC output typography

### Problem
The criterion heading renders at full H1 prose size in the ReactMarkdown preview, producing very large bold text (visible in screenshot).

### Fix
In the document preview article element (`ApplicationWorkspace.tsx` line ~1324), add heading size overrides specifically tuned for SC output:

```tsx
className="prose prose-slate max-w-none [&_p]:my-0.5 [&_ul]:my-1 [&_li]:my-0 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:mt-2 [&_h3]:mb-0.5"
```

This applies to all document tabs (resume, cover letter, SC) and normalises the heading hierarchy — SC criterion headings drop from giant H1 to readable bold labels.

Also update `server/rules/selection_criteria_rules.md` Section 7.1 to specify criterion headings should use `##` (H2) markdown rather than plain text or H1, so they render at the right size.

---

## Fix 5 — Remove Salary Insight from workspace

Covered by Fix 3 (left panel cleanup). Remove:
- `import { SalaryInsightPanel } from './SalaryInsightPanel'`
- `<SalaryInsightPanel ...>` at line ~964

---

## Fix 6 — Remove LinkedIn Optimiser from workspace + Coming Soon sidebar item

Covered partially by Fix 3. Additional:

**ApplicationWorkspace.tsx** — remove:
- LinkedIn Optimiser card JSX (~lines 926–960)
- State: `linkedInDoc`, `generatingLinkedIn`, `linkedInViewerOpen`
- Handler: `handleGenerateLinkedIn`
- LinkedIn viewer modal JSX (~lines 1039+)

**DashboardLayout.tsx** — add a non-navigating LinkedIn item between "Documents" and "Email Templates":

```tsx
<div
  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, opacity: 0.5, cursor: 'not-allowed' }}
  title="Coming soon"
>
  <Linkedin size={18} color={T.textMuted} />
  <span style={{ fontSize: 13, fontWeight: 600, color: T.textMuted }}>LinkedIn</span>
  <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'rgba(99,102,241,0.12)', color: '#818cf8', padding: '2px 6px', borderRadius: 4 }}>
    Soon
  </span>
</div>
```

---

## Fix 7 — Application Tracker: optimistic status updates

### Problem
`updateJobMutation.mutate()` waits for server response before updating UI — perceptible lag.

### Fix (`src/components/ApplicationTracker.tsx`)

Add React Query optimistic update pattern to `updateJobMutation`:

```ts
onMutate: async ({ id, status, dateApplied }) => {
  await queryClient.cancelQueries({ queryKey: ['jobs'] });
  const previous = queryClient.getQueryData<Job[]>(['jobs']);
  queryClient.setQueryData<Job[]>(['jobs'], old =>
    old?.map(j => j.id === id ? { ...j, status, ...(dateApplied ? { dateApplied } : {}) } : j) ?? []
  );
  return { previous };
},
onError: (_err, _vars, context) => {
  if (context?.previous) queryClient.setQueryData(['jobs'], context.previous);
  toast.error('Failed to update status');
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['jobs'] });
},
```

Remove the existing `onError` that just shows a toast (it's replaced by the above).

---

## Fix 8 — Remove "HOW DID THIS LAND?" FeedbackBar

Remove from `ApplicationWorkspace.tsx`:
- `import { FeedbackBar } from './FeedbackBar'`
- `<FeedbackBar ...>` at line ~1367

`FeedbackBar.tsx` itself is left in place (don't delete) — it may be needed later.

---

## Files Changed

| File | Change |
|---|---|
| `server/prisma/schema.prisma` | Add `profileAdvisorCallsToday`, `profileAdvisorCallsDate` to CandidateProfile |
| `server/src/routes/profile/education.ts` | Add POST + DELETE endpoints |
| `server/src/routes/profile/certifications.ts` | New file — full CRUD |
| `server/src/routes/profile/volunteering.ts` | New file — full CRUD |
| `server/src/routes/profile/index.ts` | Register new routers |
| `server/src/routes/ai-tools.ts` | Add daily rate limit to profile-advisor endpoint |
| `server/rules/selection_criteria_rules.md` | Update heading format to use `##` |
| `src/components/ProfileBank.tsx` | Add CRUD UI for Education, Certifications, Volunteering, Skills tag editor |
| `src/components/ProfileAdvisorPanel.tsx` | Daily limit handling + smart gate UI |
| `src/components/ApplicationWorkspace.tsx` | Remove LinkedIn Optimiser, Salary Insight, Profile Gap Analysis (SC tab), FeedbackBar; fix SC auto-gen; fix document preview heading styles |
| `src/components/ApplicationTracker.tsx` | Optimistic status update |
| `src/layouts/DashboardLayout.tsx` | Add LinkedIn Coming Soon nav item |

---

## Out of Scope
- Building out the LinkedIn Hub page (separate sub-project)
- ProfileBank section for Languages (separate item, no explicit request)
- Removing `FeedbackBar.tsx` file itself
- Removing `SalaryInsightPanel.tsx` file itself
