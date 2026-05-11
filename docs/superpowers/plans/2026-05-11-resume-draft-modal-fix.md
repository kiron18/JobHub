# Resume Draft Modal Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Here's your resume / You know it's not working" welcome modal with a positive single-CTA flow that downloads then opens the wizard, strip placeholder markers from the baseline resume prompt, and delete the deprecated 70% milestone popup.

**Architecture:** Three localised changes — one backend prompt edit, one component rewrite, one file deletion. No new dependencies, no schema changes, no new routes. The existing `/profile/baseline-resume` GET (status) and POST (`/generate`) endpoints already support the polling pattern.

**Tech Stack:** React 19 + TypeScript + Vite + Framer Motion + Sonner toasts + axios. Server side: Express + Prisma + LLM-call utility.

**Spec:** `docs/superpowers/specs/2026-05-11-resume-draft-modal-fix-design.md`

**Verification:** Project has no unit test framework configured (only `vite`, `tsc -b`, `eslint`). Each task verifies via `npm run build` (typecheck + bundle) plus a final manual smoke test against the dev server.

---

## Task 1: Strip placeholder instruction from baseline resume prompt

**Files:**
- Modify: `server/src/services/baselineResume.ts:40-44`

- [ ] **Step 1: Edit the prompt's ADDITIONAL RULES block**

Open `server/src/services/baselineResume.ts`. Locate the multi-line prompt template (lines 25–44). The current `ADDITIONAL RULES:` block reads:

```ts
ADDITIONAL RULES:
- Where a quantified metric is absent, insert a placeholder in this EXACT format: [Add: e.g. reduced processing time by X%]
- Do NOT fabricate metrics or details not present in the original resume.
- Fix every weakness identified in the diagnostic findings.
- Australian English throughout (organisation, programme, behaviour, recognise, etc.)
- Output the complete resume in clean markdown only. No preamble, no meta-commentary, no explanations — just the resume.`;
```

Replace with:

```ts
ADDITIONAL RULES:
- Use only information explicitly present in the candidate's resume above. Do NOT insert placeholder text, bracketed prompts, or fill-in markers of any kind. If a metric is missing, write the bullet without it — clean, factual, action-led.
- Clean up formatting: consistent dates, proper section hierarchy, ATS-safe markdown headings, parallel bullet structure across roles.
- Do NOT fabricate metrics or details not present in the original resume.
- Fix every weakness identified in the diagnostic findings.
- Australian English throughout (organisation, programme, behaviour, recognise, etc.)
- The output is a polished draft ready for immediate use as-is. Output the complete resume in clean markdown only. No preamble, no meta-commentary, no explanations — just the resume.`;
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: build completes with no errors. (The full build runs `tsc -b` followed by `vite build`. The server file is part of a separate tsconfig — if it isn't picked up by `tsc -b` from the repo root, also run `cd server && npx tsc --noEmit` and expect zero errors.)

- [ ] **Step 3: Commit**

```bash
git add server/src/services/baselineResume.ts
git commit -m "fix(baseline-resume): remove [Add: e.g. ...] placeholder instruction from LLM prompt"
```

---

## Task 2: Remove milestone modal wiring from ProfileBank

**Files:**
- Modify: `src/components/ProfileBank.tsx` (import, state, effect, render)
- Delete: `src/components/MilestoneModal.tsx`

- [ ] **Step 1: Remove the import**

In `src/components/ProfileBank.tsx`, locate line 17:

```ts
import { MilestoneModal } from './MilestoneModal';
```

Delete this line entirely.

- [ ] **Step 2: Remove the state and ref**

Locate lines 1512 and 1515 (inside the component body):

```ts
const [activeMilestone, setActiveMilestone] = useState<50 | 70 | null>(null);
```

```ts
const prevScoreRef = useRef<number | null>(null);
```

Delete both lines. `useRef` may still be needed by other code in the file — verify by searching the file for other `useRef(` occurrences. If `prevScoreRef` is the only usage, also remove `useRef` from the React import on line 1. If other refs exist, leave the import alone.

- [ ] **Step 3: Remove the milestone effect**

Locate the `React.useEffect` block at approximately lines 1520–1533 that begins with the comment "Fire milestone modal only when score crosses threshold…" and ends with `}, [profile, isFetching]);`. Delete the entire comment + effect block, including the leading comment lines.

- [ ] **Step 4: Remove the MilestoneModal render**

Locate lines 1740–1745:

```tsx
{/* Milestone celebration modals */}
<MilestoneModal
  milestone={activeMilestone}
  onClose={() => setActiveMilestone(null)}
  isDark={isDark}
/>
```

Delete this entire block (comment plus JSX element).

- [ ] **Step 5: Delete the MilestoneModal file**

Run: `git rm src/components/MilestoneModal.tsx`

- [ ] **Step 6: Verify no remaining references**

Run: `grep -rn "MilestoneModal" src/ server/`
Expected: no output (zero matches).

If any reference remains, stop and resolve before continuing.

- [ ] **Step 7: Typecheck**

Run: `npm run build`
Expected: no TypeScript errors. Common failure mode: `useRef` left in import but no longer used → ESLint/TS may flag it. Fix the import if so.

- [ ] **Step 8: Commit**

```bash
git add src/components/ProfileBank.tsx src/components/MilestoneModal.tsx
git commit -m "fix(profile-bank): remove deprecated 70% milestone modal (no longer valid)"
```

---

## Task 3: Rewrite `handleBaselineDownload` with polling-and-advance

**Files:**
- Modify: `src/components/ProfileBank.tsx:1540-1564` (the `handleBaselineDownload` function)

- [ ] **Step 1: Replace the handler body**

Locate the current `handleBaselineDownload` at lines 1540–1564:

```ts
const handleBaselineDownload = async () => {
  if (baselineDownloading) return;
  setBaselineDownloading(true);
  try {
    const { data } = await api.get('/profile/baseline-resume');
    if (data.status === 'ready' && data.documentId) {
      const { data: doc } = await api.get(`/documents/${data.documentId}`);
      const { exportDocx } = await import('../lib/exportDocx');
      await exportDocx(doc.content, 'resume', '');
      const score = profile?.completion?.score ?? 0;
      if (score >= 75) {
        setBaselineDownloaded(true); // Strong profile — show success state
      } else {
        dismissWelcomeModal();
        navigate('/setup'); // Low/mid score — go straight to wizard
      }
    } else {
      toast.error('Resume not ready yet — check back in a moment.');
    }
  } catch {
    toast.error('Download failed — please try again.');
  } finally {
    setBaselineDownloading(false);
  }
};
```

Replace with:

```ts
const handleBaselineDownload = async () => {
  if (baselineDownloading) return;
  setBaselineDownloading(true);

  const downloadAndAdvance = async (documentId: string) => {
    const { data: doc } = await api.get(`/documents/${documentId}`);
    const { exportDocx } = await import('../lib/exportDocx');
    await exportDocx(doc.content, 'resume', '');
    dismissWelcomeModal();
    navigate('/setup');
  };

  try {
    // 1. Check current status
    const { data } = await api.get('/profile/baseline-resume');
    if (data.status === 'ready' && data.documentId) {
      await downloadAndAdvance(data.documentId);
      return;
    }

    // 2. Trigger generation (idempotent — server returns 'ready' if already done)
    try {
      const { data: genData } = await api.post('/profile/baseline-resume/generate');
      if (genData.status === 'ready' && genData.documentId) {
        await downloadAndAdvance(genData.documentId);
        return;
      }
    } catch {
      // Generation trigger failed — fall through to polling, which will time out and still advance.
    }

    // 3. Poll up to 15 times (2s apart, ~30s total)
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        const { data: poll } = await api.get('/profile/baseline-resume');
        if (poll.status === 'ready' && poll.documentId) {
          await downloadAndAdvance(poll.documentId);
          return;
        }
      } catch {
        // Transient error — keep polling
      }
    }

    // 4. Timeout — advance anyway, never dead-end the user
    toast('Still preparing your resume — opening your wizard so you can get started.');
    dismissWelcomeModal();
    navigate('/setup');
  } catch {
    toast("Couldn't reach the server — opening your wizard so you can get started.");
    dismissWelcomeModal();
    navigate('/setup');
  } finally {
    setBaselineDownloading(false);
  }
};
```

- [ ] **Step 2: Remove the `baselineDownloaded` state (no longer used)**

Locate line 1514:

```ts
const [baselineDownloaded, setBaselineDownloaded] = useState(false);
```

Delete this line. The post-download success sub-modal that depended on it will be removed in Task 4.

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: no errors. If `baselineDownloaded` is still referenced anywhere (it will be in the modal JSX, removed in Task 4), the typecheck will fail with `baselineDownloaded is not defined`. That's expected — proceed to Task 4 without committing yet.

**Do not commit at the end of this task** — the next task removes the JSX that references the deleted state. Commit at the end of Task 4 to keep the tree compiling between commits.

---

## Task 4: Rewrite the welcome modal markup with the new copy

**Files:**
- Modify: `src/components/ProfileBank.tsx` — the `hasCompletedOnboarding === true` branch of the welcome modal (approximately lines 1618–1695)

- [ ] **Step 1: Replace the onboarded branch of the welcome modal**

Locate the conditional in the welcome modal (around line 1618):

```tsx
{(profile as any)?.hasCompletedOnboarding ? (
  baselineDownloaded ? (
    /* Post-download state — only shown for strong profiles (score >= 75) */
    <>
      ...post-download success block...
    </>
  ) : (
    /* Baseline resume gift — competitive framing */
    <>
      ...current "Here's your resume" block...
    </>
  )
) : (
  /* Explanation for non-onboarded users */
  <>
    ...3-step Achievement Bank explainer (UNCHANGED)...
  </>
)}
```

Replace the entire **onboarded branch** (the `(profile as any)?.hasCompletedOnboarding ? ( ... ) : ` portion, including both the `baselineDownloaded` true and false sub-branches) with this single block. The non-onboarded `: ( ... )` branch is preserved unchanged.

```tsx
{(profile as any)?.hasCompletedOnboarding ? (
  <>
    {/* Heading */}
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 22, fontWeight: 900, color: isDark ? '#f3f4f6' : '#111827', margin: '0 0 14px', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
        Claim your <span style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #7c3aed 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Personalised Resume Draft</span>.
      </h3>
      <p style={{ fontSize: 14, color: isDark ? '#d1d5db' : '#374151', margin: 0, lineHeight: 1.6 }}>
        This is your strong foundation, built from your diagnostic and ready to use.
      </p>
    </div>

    {/* Wizard upsell body */}
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280', margin: '0 0 12px', lineHeight: 1.65 }}>
        Want to make it truly exceptional? Our optimisation wizard helps you add specific achievements and formats that get you noticed by hiring managers.
      </p>
      <p style={{ fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280', margin: 0, lineHeight: 1.65 }}>
        Turn a strong start into an unstoppable application.
      </p>
    </div>

    {/* Single CTA */}
    <button
      onClick={handleBaselineDownload}
      disabled={baselineDownloading}
      style={{
        width: '100%', padding: '14px 0', borderRadius: 10,
        background: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #7c3aed 100%)',
        border: 'none', color: '#fff', fontSize: 14, fontWeight: 800,
        cursor: baselineDownloading ? 'wait' : 'pointer',
        opacity: baselineDownloading ? 0.8 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        letterSpacing: '-0.01em',
        boxShadow: '0 4px 20px rgba(236, 72, 153, 0.3)',
      }}
    >
      {baselineDownloading ? (
        <>
          <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
          Preparing your resume…
        </>
      ) : (
        <>
          <Download size={15} />
          Let's get unstoppable
        </>
      )}
    </button>
  </>
) : (
  /* Explanation for non-onboarded users — UNCHANGED, keep the existing JSX below this line */
```

The closing `: ( ... )}` of the conditional and the non-onboarded branch JSX remain exactly as-is.

- [ ] **Step 2: Confirm the `FileText` icon import is still needed elsewhere**

The old onboarded branch used `<FileText size={24} … />`. The new branch does not. Search the file:

Run: `grep -n "FileText" src/components/ProfileBank.tsx`

If `FileText` is still referenced elsewhere (e.g. in the non-onboarded branch — it isn't, but check anyway), leave the import alone. If it's no longer referenced, remove `FileText` from the lucide-react import on line 8. The non-onboarded branch uses `Star` (line ~1701), so `FileText` should now be unused.

- [ ] **Step 3: Confirm `CheckCircle` is still needed**

The deleted "Your resume is ready" success block used `<CheckCircle size={24} … />`. Check whether `CheckCircle` is referenced elsewhere in the file:

Run: `grep -n "CheckCircle" src/components/ProfileBank.tsx`

Note that `CheckCircle2` is a different icon and is unrelated. If `CheckCircle` (without the `2`) has no remaining usages, remove it from the lucide-react import on line 6. Otherwise leave it.

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: zero errors. The `baselineDownloaded` state removed in Task 3 should now have zero references, so the tree compiles.

- [ ] **Step 5: Commit the combined Task 3 + Task 4 changes**

```bash
git add src/components/ProfileBank.tsx
git commit -m "feat(profile-bank): rewrite welcome modal with single CTA and graceful download polling"
```

---

## Task 5: Manual smoke test and final verification

**Files:** none modified — verification only.

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`
Expected: Vite starts on http://localhost:5173 (or whatever port is configured). No console errors on boot.

- [ ] **Step 2: Smoke-test path A — resume already generated**

Log in as a user whose baseline resume has already been generated (check via `SELECT * FROM "Document" WHERE type = 'BASELINE_RESUME' LIMIT 1;` if needed). Clear the `jobhub_profile_visited` localStorage key in DevTools so the welcome modal fires. Navigate to the Achievement Bank page.

Verify:
- The welcome modal renders the new heading "Claim your Personalised Resume Draft." with the gradient on "Personalised Resume Draft".
- The three body paragraphs are present in the correct order with AU English.
- The single gradient button reads "Let's get unstoppable" with a download icon, no trailing arrow.
- No file icon at the top of the modal.
- Clicking the button shows "Preparing your resume…" with a spinner briefly, then a .docx downloads.
- The page then navigates to `/setup` (the wizard).
- No "Resume not ready yet" toast appears at any point.

- [ ] **Step 3: Smoke-test path B — resume still generating**

In a fresh user state (or by deleting the BASELINE_RESUME document in the DB and clearing the localStorage key), trigger the welcome modal. Click the CTA.

Verify:
- The button shows the spinner / "Preparing your resume…" state for as long as generation takes (typically several seconds).
- Once generation finishes, the document downloads and the page navigates to `/setup`.
- If generation takes longer than ~30 seconds, the toast "Still preparing your resume — opening your wizard so you can get started." appears and the page still navigates to `/setup`. No error toast.

- [ ] **Step 4: Smoke-test path C — no milestone popup**

Confirm no 70% / 50% milestone modal fires under any circumstance on the Achievement Bank page, even when adding achievements that push the completion score across 70.

- [ ] **Step 5: Verify the downloaded .docx**

Open the downloaded resume file. Confirm:
- No `[Add: e.g. …]` placeholders anywhere.
- No bracketed fill-in markers of any kind.
- Bullets without metrics still read as clean, action-led statements.

Note: Existing baseline resumes generated before Task 1 may still contain placeholders — this is intentional per spec (Option A, no backfill). Test with a freshly-generated resume by deleting the existing BASELINE_RESUME document for your test user and re-triggering generation via the modal.

- [ ] **Step 6: Verify the non-onboarded branch is untouched**

Log in as a user with `hasCompletedOnboarding === false` (or temporarily flip it in the DB). The welcome modal should show the existing 3-step "Your Achievement Bank" explainer — the new copy is for diagnostic-completed users only.

- [ ] **Step 7: Final commit (only if any fixes were needed during smoke testing)**

If smoke testing surfaced no issues, no further commit is needed. If anything was fixed inline:

```bash
git add -A
git commit -m "fix(profile-bank): smoke test follow-ups for resume draft modal"
```

---

## Self-review checklist (for the implementing engineer before opening a PR)

- [ ] All five tasks committed.
- [ ] `npm run build` passes from the repo root.
- [ ] `grep -rn "MilestoneModal" src/ server/` returns zero matches.
- [ ] `grep -rn "baselineDownloaded" src/ server/` returns zero matches.
- [ ] `grep -rn "Add: e.g." server/src/` returns zero matches in `baselineResume.ts`.
- [ ] Manual smoke test paths A, B, C all pass.
- [ ] The non-onboarded welcome modal branch was not modified.
- [ ] No new dependencies added.
